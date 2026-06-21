
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'manager', 'employee');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  role public.app_role NOT NULL DEFAULT 'employee',
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  locale text NOT NULL DEFAULT 'en',
  city text,
  district text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR manager_id = auth.uid()
  );
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SMTP config (singleton)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.smtp_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  host text NOT NULL DEFAULT 'smtp.hostinger.com',
  port int NOT NULL DEFAULT 465,
  secure boolean NOT NULL DEFAULT true,
  username text NOT NULL DEFAULT '',
  password_encrypted bytea,
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.smtp_config TO authenticated;
GRANT ALL ON public.smtp_config TO service_role;
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_smtp_updated BEFORE UPDATE ON public.smtp_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "smtp admins read" ON public.smtp_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "smtp admins write" ON public.smtp_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.smtp_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Notification preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  inapp_enabled boolean NOT NULL DEFAULT true,
  quiet_start time,
  quiet_end time,
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pref_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "prefs self" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Notification deliveries (log)
CREATE TABLE public.notif_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient text,
  channel text NOT NULL CHECK (channel IN ('email','push','inapp')),
  status text NOT NULL CHECK (status IN ('sent','failed','suppressed','skipped_smtp','queued')),
  subject text,
  payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notif_deliveries TO authenticated;
GRANT ALL ON public.notif_deliveries TO service_role;
ALTER TABLE public.notif_deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_deliveries_user ON public.notif_deliveries(user_id, created_at DESC);

CREATE POLICY "deliveries self read" ON public.notif_deliveries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Export schedules
CREATE TABLE public.export_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_ids uuid[] NOT NULL DEFAULT '{}',
  date_range_kind text NOT NULL DEFAULT 'yesterday'
    CHECK (date_range_kind IN ('today','yesterday','last_7_days','last_30_days')),
  format text NOT NULL DEFAULT 'csv' CHECK (format IN ('csv','xlsx')),
  recipients text[] NOT NULL DEFAULT '{}',
  send_time time NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT true,
  last_run_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_schedules TO authenticated;
GRANT ALL ON public.export_schedules TO service_role;
ALTER TABLE public.export_schedules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_schedule_updated BEFORE UPDATE ON public.export_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "schedules hr admin read" ON public.export_schedules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR owner_id = auth.uid());
CREATE POLICY "schedules hr admin write" ON public.export_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Export runs (dedupe lock + history)
CREATE TABLE public.export_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.export_schedules(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','sent','failed','partial')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text,
  recipients_sent text[] NOT NULL DEFAULT '{}',
  recipients_failed text[] NOT NULL DEFAULT '{}',
  file_size_bytes int,
  row_count int,
  UNIQUE(schedule_id, run_date)
);
GRANT SELECT ON public.export_runs TO authenticated;
GRANT ALL ON public.export_runs TO service_role;
ALTER TABLE public.export_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_export_runs_sched ON public.export_runs(schedule_id, run_date DESC);

CREATE POLICY "runs hr admin read" ON public.export_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Task activity log
CREATE TABLE public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('start_task','complete_task','start_trip','complete_trip')),
  task_id uuid,
  task_name text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  city text,
  district text,
  lat double precision,
  lng double precision,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.task_activity TO authenticated;
GRANT ALL ON public.task_activity TO service_role;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_activity_emp_date ON public.task_activity(employee_id, occurred_at DESC);
CREATE INDEX idx_activity_date ON public.task_activity(occurred_at DESC);

CREATE POLICY "activity self insert" ON public.task_activity FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "activity read scope" ON public.task_activity FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = task_activity.employee_id AND p.manager_id = auth.uid())
  );
