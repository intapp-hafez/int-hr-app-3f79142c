-- 20260607183534_19e2a4dc-8618-4fa2-8e0f-be4d8bb64469.sql

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


-- 20260607183659_ae03cc7c-e155-41bd-9fdd-c11e2f855149.sql

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;


-- 20260607183922_120cb980-c548-46ba-96b6-734ed1ffe355.sql

CREATE OR REPLACE FUNCTION public.smtp_config_set_password(_key text, _password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  UPDATE public.smtp_config
     SET password_encrypted = pgp_sym_encrypt(_password, _key),
         updated_at = now()
   WHERE id = 1;
END; $$;
REVOKE EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.smtp_config_decrypt(_key text)
RETURNS TABLE (
  host text, port int, secure boolean, username text,
  password text, from_email text, from_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  RETURN QUERY
  SELECT s.host, s.port, s.secure, s.username,
         CASE WHEN s.password_encrypted IS NULL THEN ''
              ELSE pgp_sym_decrypt(s.password_encrypted, _key) END AS password,
         s.from_email, s.from_name
    FROM public.smtp_config s
   WHERE s.id = 1;
END; $$;
REVOKE EXECUTE ON FUNCTION public.smtp_config_decrypt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smtp_config_decrypt(text) TO service_role;


-- 20260607185929_8f0f060c-80c1-402f-91a9-ef35f811c9e5.sql

-- 1) Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- 2) Directory tables
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dept read auth" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept admin write" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos read auth" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "pos admin write" ON public.positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_positions_updated BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "city read auth" ON public.cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "city admin write" ON public.cities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_districts_city ON public.districts(city_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.districts TO authenticated;
GRANT ALL ON public.districts TO service_role;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dist read auth" ON public.districts FOR SELECT TO authenticated USING (true);
CREATE POLICY "dist admin write" ON public.districts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_districts_updated BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  annual_days int NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lt read auth" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "lt admin write" ON public.leave_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_leave_types_updated BEFORE UPDATE ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Profile FKs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id   uuid REFERENCES public.positions(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id       uuid REFERENCES public.cities(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id   uuid REFERENCES public.districts(id)   ON DELETE SET NULL;

-- 4) Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  in_time timestamptz,
  out_time timestamptz,
  branch text,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','absent','leave')),
  lat double precision,
  lng double precision,
  network_ok boolean,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_emp ON public.attendance(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att read scope" ON public.attendance FOR SELECT TO authenticated USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = attendance.employee_id AND p.manager_id = auth.uid())
);
CREATE POLICY "att self insert" ON public.attendance FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "att self update" ON public.attendance FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "att admin delete" ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Leaves
CREATE TABLE IF NOT EXISTS public.leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE SET NULL,
  leave_type_name text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days int NOT NULL DEFAULT 1,
  paid boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reason text,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leaves_emp ON public.leaves(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaves TO authenticated;
GRANT ALL ON public.leaves TO service_role;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaves read scope" ON public.leaves FOR SELECT TO authenticated USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
);
CREATE POLICY "leaves self insert" ON public.leaves FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "leaves update scope" ON public.leaves FOR UPDATE TO authenticated USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
) WITH CHECK (true);
CREATE POLICY "leaves admin delete" ON public.leaves FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leaves
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6) Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  due_date date,
  due_time text,
  city text,
  district text,
  address text,
  estimated_hours numeric,
  assignees uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assignees ON public.tasks USING gin(assignees);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks read scope" ON public.tasks FOR SELECT TO authenticated USING (
  created_by = auth.uid()
  OR auth.uid() = ANY (assignees)
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR public.has_role(auth.uid(),'manager')
);
CREATE POLICY "tasks manager insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
CREATE POLICY "tasks update scope" ON public.tasks FOR UPDATE TO authenticated USING (
  created_by = auth.uid()
  OR auth.uid() = ANY (assignees)
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
) WITH CHECK (true);
CREATE POLICY "tasks delete admin" ON public.tasks FOR DELETE TO authenticated USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7) Trips
CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination text NOT NULL,
  address text,
  trip_date date NOT NULL,
  trip_time text,
  purpose text,
  notes text,
  assignee uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trips_assignee ON public.trips(assignee);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips read scope" ON public.trips FOR SELECT TO authenticated USING (
  assignee = auth.uid()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR public.has_role(auth.uid(),'manager')
);
CREATE POLICY "trips manager insert" ON public.trips FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
CREATE POLICY "trips update scope" ON public.trips FOR UPDATE TO authenticated USING (
  assignee = auth.uid()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
) WITH CHECK (true);
CREATE POLICY "trips delete" ON public.trips FOR DELETE TO authenticated USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 20260607190045_2474b4b1-2f15-4382-b5a6-5348aa426be2.sql

DROP POLICY IF EXISTS "leaves update scope" ON public.leaves;
CREATE POLICY "leaves update scope" ON public.leaves FOR UPDATE TO authenticated USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
) WITH CHECK (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
);

DROP POLICY IF EXISTS "tasks update scope" ON public.tasks;
CREATE POLICY "tasks update scope" ON public.tasks FOR UPDATE TO authenticated USING (
  created_by = auth.uid()
  OR auth.uid() = ANY (assignees)
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
) WITH CHECK (
  created_by = auth.uid()
  OR auth.uid() = ANY (assignees)
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);

DROP POLICY IF EXISTS "trips update scope" ON public.trips;
CREATE POLICY "trips update scope" ON public.trips FOR UPDATE TO authenticated USING (
  assignee = auth.uid()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
) WITH CHECK (
  assignee = auth.uid()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);


-- 20260607190154_543233bf-400c-476b-8f9a-10c4af534e97.sql

REVOKE EXECUTE ON FUNCTION public.smtp_config_decrypt(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smtp_config_decrypt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) TO service_role;


-- 20260607212220_95a5c59b-2104-465a-95d7-91dfa6f79535.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_chk CHECK (status IN ('Active','Inactive'));

-- 20260607222255_e19f4953-0a89-4c61-a265-7662cc4e6002.sql
create or replace function public.import_employee_profile(
  _full_name text,
  _email text,
  _phone text default null,
  _role public.app_role default 'employee',
  _city text default null,
  _district text default null,
  _department_id uuid default null,
  _position_id uuid default null,
  _status text default 'Active',
  _avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _existing_id uuid;
  _new_id uuid;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'hr')) then
    raise exception 'Only admins or HR can import employees';
  end if;

  _email := lower(trim(coalesce(_email, '')));
  _full_name := nullif(trim(coalesce(_full_name, '')), '');

  if _full_name is null then
    raise exception 'Name is required';
  end if;

  if _email = '' then
    raise exception 'Email is required';
  end if;

  select id into _existing_id
  from public.profiles
  where lower(email) = _email
  limit 1;

  if _existing_id is not null then
    raise exception 'Email already exists';
  end if;

  _new_id := gen_random_uuid();

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    city,
    district,
    department_id,
    position_id,
    status,
    avatar_url
  ) values (
    _new_id,
    _full_name,
    _email,
    nullif(trim(coalesce(_phone, '')), ''),
    _role,
    nullif(trim(coalesce(_city, '')), ''),
    nullif(trim(coalesce(_district, '')), ''),
    _department_id,
    _position_id,
    case when _status = 'Inactive' then 'Inactive' else 'Active' end,
    nullif(trim(coalesce(_avatar_url, '')), '')
  );

  insert into public.user_roles (user_id, role)
  values (_new_id, _role)
  on conflict (user_id, role) do nothing;

  return _new_id;
end;
$$;

grant execute on function public.import_employee_profile(text, text, text, public.app_role, text, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.import_employee_profile(text, text, text, public.app_role, text, text, uuid, uuid, text, text) to service_role;

-- 20260607234722_8f43eea5-a5ee-4efc-894f-cac88b2881fd.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emp_code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_emp_code_unique ON public.profiles (emp_code) WHERE emp_code IS NOT NULL;

-- 20260608000845_848d4807-3cb8-47be-9c0f-eac1b6f04642.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS id_issue_date date,
  ADD COLUMN IF NOT EXISTS id_expiry_date date;

-- 20260608001831_5c87d7da-ead5-428a-9f9a-f417299b1fdc.sql

-- 1) Documents table
CREATE TABLE public.profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 2097152),
  data_url text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_documents_profile_idx ON public.profile_documents(profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_documents TO authenticated;
GRANT ALL ON public.profile_documents TO service_role;

ALTER TABLE public.profile_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own documents"
  ON public.profile_documents FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Admin/HR can insert documents"
  ON public.profile_documents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Admin/HR can update documents"
  ON public.profile_documents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Admin/HR can delete documents"
  ON public.profile_documents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER profile_documents_set_updated_at
  BEFORE UPDATE ON public.profile_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) DB-side rule: issue date cannot be after expiry date
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_dates_chk
  CHECK (id_issue_date IS NULL OR id_expiry_date IS NULL OR id_issue_date <= id_expiry_date);


-- 20260608005511_09f91c3b-4af6-4a2e-a574-6a26ad418483.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salary_mode TEXT CHECK (salary_mode IN ('gross','net')),
  ADD COLUMN IF NOT EXISTS salary_gross NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS salary_net NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS allowance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_duration TEXT CHECK (target_duration IN ('Daily','Weekly','Monthly','Quarterly','Yearly')),
  ADD COLUMN IF NOT EXISTS contract_type TEXT CHECK (contract_type IN ('FullTime','PartTime','Temporary','Internship','Probation3M'));

-- 20260608010357_ddbfb58b-bccd-4f23-a1b1-10364cb0cbd9.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_cancelled BOOLEAN NOT NULL DEFAULT FALSE;

-- 20260608012048_41d1d257-8eac-4c14-89bf-78991a6c2903.sql

-- Geofence locations
CREATE TABLE public.geofence_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_locations TO authenticated;
GRANT ALL ON public.geofence_locations TO service_role;
ALTER TABLE public.geofence_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR manage geofences" ON public.geofence_locations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Authenticated can view active geofences" ON public.geofence_locations
  FOR SELECT TO authenticated USING (active = true);
CREATE TRIGGER geofence_locations_set_updated_at
  BEFORE UPDATE ON public.geofence_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Geofence assignments (many-to-many)
CREATE TABLE public.geofence_assignments (
  location_id uuid NOT NULL REFERENCES public.geofence_locations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (location_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_assignments TO authenticated;
GRANT ALL ON public.geofence_assignments TO service_role;
ALTER TABLE public.geofence_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR manage geofence assignments" ON public.geofence_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Users can view their assignments" ON public.geofence_assignments
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- Contract audit log
CREATE TABLE public.contract_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  reason text,
  previous_end_date date,
  new_end_date date,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.contract_audit_log TO authenticated;
GRANT ALL ON public.contract_audit_log TO service_role;
ALTER TABLE public.contract_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR view contract audit" ON public.contract_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Admins/HR insert contract audit" ON public.contract_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE INDEX contract_audit_log_profile_idx ON public.contract_audit_log(profile_id, created_at DESC);


-- 20260608105849_8a0d73c8-69d0-4e5b-a6b9-79f539377620.sql

CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  type text NOT NULL DEFAULT 'public' CHECK (type IN ('public','company','weekend')),
  country text,
  recurring boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX holidays_date_idx ON public.holidays(date);
CREATE UNIQUE INDEX holidays_date_name_uidx ON public.holidays(date, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view holidays"
  ON public.holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and HR can insert holidays"
  ON public.holidays FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Admins and HR can update holidays"
  ON public.holidays FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Admins and HR can delete holidays"
  ON public.holidays FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER holidays_set_updated_at
  BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 20260608111828_5abea3c3-4ec4-43ea-a30f-d56d0ec5e01d.sql

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_employee_profile(text, text, text, app_role, text, text, uuid, uuid, text, text) FROM PUBLIC, anon;

CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;


-- 20260608114012_0c114abd-98a1-4f3f-bc60-e49e92ceeb4a.sql

-- ============== shifts ==============
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  grace_minutes int NOT NULL DEFAULT 0,
  is_overnight boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts read auth" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "shifts admin write" ON public.shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============== late_penalties ==============
CREATE TABLE public.late_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  from_minutes int NOT NULL,
  to_minutes int NOT NULL,
  penalty_type text NOT NULL CHECK (penalty_type IN ('deduction_minutes','deduction_amount','warning')),
  penalty_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.late_penalties TO authenticated;
GRANT ALL ON public.late_penalties TO service_role;
ALTER TABLE public.late_penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "late_penalties read auth" ON public.late_penalties FOR SELECT TO authenticated USING (true);
CREATE POLICY "late_penalties admin write" ON public.late_penalties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_late_penalties_updated BEFORE UPDATE ON public.late_penalties FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============== allowances ==============
CREATE TABLE public.allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fixed','percent','per_day','per_km')),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EGP',
  taxable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowances TO authenticated;
GRANT ALL ON public.allowances TO service_role;
ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allowances read auth" ON public.allowances FOR SELECT TO authenticated USING (true);
CREATE POLICY "allowances admin write" ON public.allowances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_allowances_updated BEFORE UPDATE ON public.allowances FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============== targets_overtime ==============
CREATE TABLE public.targets_overtime (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  daily_target_hours numeric NOT NULL DEFAULT 8,
  weekly_target_hours numeric NOT NULL DEFAULT 40,
  overtime_rate numeric NOT NULL DEFAULT 1.5,
  overtime_cap_hours numeric NOT NULL DEFAULT 4,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets_overtime TO authenticated;
GRANT ALL ON public.targets_overtime TO service_role;
ALTER TABLE public.targets_overtime ENABLE ROW LEVEL SECURITY;
CREATE POLICY "targets_overtime read auth" ON public.targets_overtime FOR SELECT TO authenticated USING (true);
CREATE POLICY "targets_overtime admin write" ON public.targets_overtime FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_targets_overtime_updated BEFORE UPDATE ON public.targets_overtime FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============== kpis ==============
CREATE TABLE public.kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  metric text NOT NULL,
  target_value numeric NOT NULL DEFAULT 0,
  unit text,
  period text NOT NULL DEFAULT 'monthly' CHECK (period IN ('daily','weekly','monthly','quarterly','yearly')),
  weight numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis TO authenticated;
GRANT ALL ON public.kpis TO service_role;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpis read auth" ON public.kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpis admin write" ON public.kpis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_kpis_updated BEFORE UPDATE ON public.kpis FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============== holiday_types ==============
CREATE TABLE public.holiday_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#3B82F6',
  is_paid boolean NOT NULL DEFAULT true,
  affects_attendance boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_types TO authenticated;
GRANT ALL ON public.holiday_types TO service_role;
ALTER TABLE public.holiday_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holiday_types read auth" ON public.holiday_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "holiday_types admin write" ON public.holiday_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_holiday_types_updated BEFORE UPDATE ON public.holiday_types FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============== networks ==============
CREATE TABLE public.networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ssid text,
  bssid text,
  branch text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX networks_ssid_bssid_uniq ON public.networks(ssid, bssid) WHERE ssid IS NOT NULL AND bssid IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.networks TO authenticated;
GRANT ALL ON public.networks TO service_role;
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "networks read auth" ON public.networks FOR SELECT TO authenticated USING (true);
CREATE POLICY "networks admin write" ON public.networks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_networks_updated BEFORE UPDATE ON public.networks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 20260608124624_c7ac51b6-734e-478c-88ba-4079f1a731b8.sql
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS free_check boolean NOT NULL DEFAULT false;

-- 20260608125506_cfc2b5e0-5945-4af2-9431-4109f979355c.sql

CREATE TABLE public.network_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(network_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_assignments TO authenticated;
GRANT ALL ON public.network_assignments TO service_role;
ALTER TABLE public.network_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HR manage network assignments"
  ON public.network_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Users can view their own network assignments"
  ON public.network_assignments FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE INDEX idx_network_assignments_profile ON public.network_assignments(profile_id);
CREATE INDEX idx_network_assignments_network ON public.network_assignments(network_id);


-- 20260608131950_f42c2a9e-bb2c-419b-9958-0c3c37e85f6a.sql

-- Leave balances per employee/leave_type/year
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  total_days integer NOT NULL DEFAULT 0,
  used_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own balances" ON public.leave_balances
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE POLICY "Admin/HR manage balances" ON public.leave_balances
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE TRIGGER trg_leave_balances_updated BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed balances for any existing employees from active leave types
INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days)
SELECT p.id, lt.id, EXTRACT(YEAR FROM now())::int, lt.annual_days
FROM public.profiles p
CROSS JOIN public.leave_types lt
WHERE lt.active = true
ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

-- Function: seed balances for a new profile
CREATE OR REPLACE FUNCTION public.seed_leave_balances_for_employee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days)
  SELECT NEW.id, lt.id, EXTRACT(YEAR FROM now())::int, lt.annual_days
  FROM public.leave_types lt WHERE lt.active = true
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_leave_balances ON public.profiles;
CREATE TRIGGER trg_seed_leave_balances AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_leave_balances_for_employee();

-- Function: seed balances for new leave type across employees
CREATE OR REPLACE FUNCTION public.seed_leave_balances_for_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active THEN
    INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days)
    SELECT p.id, NEW.id, EXTRACT(YEAR FROM now())::int, NEW.annual_days
    FROM public.profiles p
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_balances_for_type ON public.leave_types;
CREATE TRIGGER trg_seed_balances_for_type AFTER INSERT ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION public.seed_leave_balances_for_type();

-- Apply/restore used_days on leave status change
CREATE OR REPLACE FUNCTION public.apply_leave_balance_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr integer := EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date))::int;
  was_approved boolean := (TG_OP = 'UPDATE' AND OLD.status = 'approved');
  is_approved  boolean := (TG_OP <> 'DELETE' AND NEW.status = 'approved');
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' AND OLD.leave_type_id IS NOT NULL THEN
      UPDATE public.leave_balances SET used_days = GREATEST(0, used_days - OLD.days)
      WHERE employee_id = OLD.employee_id AND leave_type_id = OLD.leave_type_id AND year = yr;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.leave_type_id IS NULL THEN RETURN NEW; END IF;

  IF is_approved AND NOT was_approved THEN
    INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days, used_days)
    VALUES (NEW.employee_id, NEW.leave_type_id, yr, 0, NEW.days)
    ON CONFLICT (employee_id, leave_type_id, year)
    DO UPDATE SET used_days = public.leave_balances.used_days + NEW.days;
  ELSIF was_approved AND NOT is_approved THEN
    UPDATE public.leave_balances SET used_days = GREATEST(0, used_days - OLD.days)
    WHERE employee_id = OLD.employee_id AND leave_type_id = OLD.leave_type_id AND year = yr;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_apply_leave_balance ON public.leaves;
CREATE TRIGGER trg_apply_leave_balance
AFTER INSERT OR UPDATE OF status OR DELETE ON public.leaves
FOR EACH ROW EXECUTE FUNCTION public.apply_leave_balance_change();


-- 20260608132028_3b21340c-77af-4cc4-ab2b-0f031c39e930.sql

REVOKE EXECUTE ON FUNCTION public.seed_leave_balances_for_employee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_leave_balances_for_type() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_leave_balance_change() FROM PUBLIC, anon, authenticated;


-- 20260608143432_a03f57d8-df5b-45e6-9c6d-393dde7c2eb9.sql

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','draft')),
  working_days integer NOT NULL DEFAULT 22,
  late_penalty_ratio numeric NOT NULL DEFAULT 0.25,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  employee_count integer NOT NULL DEFAULT 0,
  locked_by uuid,
  locked_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payroll runs" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payroll_runs_updated BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.payroll_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  department text,
  salary numeric NOT NULL DEFAULT 0,
  allowance numeric NOT NULL DEFAULT 0,
  daily_rate numeric NOT NULL DEFAULT 0,
  present_days integer NOT NULL DEFAULT 0,
  late_days integer NOT NULL DEFAULT 0,
  absent_days integer NOT NULL DEFAULT 0,
  leave_days integer NOT NULL DEFAULT 0,
  penalty numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  kpi integer NOT NULL DEFAULT 0,
  target_met boolean NOT NULL DEFAULT false,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_run_items TO authenticated;
GRANT ALL ON public.payroll_run_items TO service_role;
ALTER TABLE public.payroll_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payroll items" ON public.payroll_run_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_payroll_run_items_run ON public.payroll_run_items(run_id);
CREATE INDEX idx_payroll_run_items_emp ON public.payroll_run_items(employee_id);


-- 20260608160533_708e4734-82f7-4a8f-8916-65f717c357af.sql

-- Permissions system: role defaults + per-user overrides

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  page text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, page)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_perms_read_all_auth"
  ON public.role_permissions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "role_perms_admin_write"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_role_perms_updated_at BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page text NOT NULL,
  can_view boolean,
  can_create boolean,
  can_edit boolean,
  can_delete boolean,
  can_export boolean,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page)
);

GRANT SELECT ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_perm_read_self_or_admin"
  ON public.user_permission_overrides FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
  );

CREATE POLICY "user_perm_admin_write"
  ON public.user_permission_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_user_perm_updated_at BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- Effective permission resolver
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _page text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override boolean;
  v_role_val boolean;
  v_role public.app_role;
  v_col text;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _action NOT IN ('view','create','edit','delete','export') THEN RETURN false; END IF;

  -- admin: full access
  IF public.has_role(_user_id, 'admin') THEN RETURN true; END IF;

  v_col := 'can_' || _action;

  -- Check user override first
  EXECUTE format(
    'SELECT %I FROM public.user_permission_overrides WHERE user_id = $1 AND page = $2',
    v_col
  ) INTO v_override USING _user_id, _page;
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;

  -- Pick highest-privilege admin role for this user: hr > manager > user
  SELECT role INTO v_role FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('hr','manager','user')
    ORDER BY CASE role WHEN 'hr' THEN 1 WHEN 'manager' THEN 2 WHEN 'user' THEN 3 END
    LIMIT 1;
  IF v_role IS NULL THEN RETURN false; END IF;

  EXECUTE format(
    'SELECT %I FROM public.role_permissions WHERE role = $1 AND page = $2',
    v_col
  ) INTO v_role_val USING v_role, _page;

  RETURN COALESCE(v_role_val, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, anon;


-- Seed default role permissions
WITH pages(slug) AS (VALUES
  ('employees'),('attendance'),('leaves'),('leaves-requests'),('payroll'),
  ('holidays'),('holiday-types'),('contracts'),('kpis'),('allowances'),
  ('late-penalties'),('targets-overtime'),('shifts'),('networks'),('geofencing'),
  ('directory'),('employee-access'),('audit'),('reports'),('settings'),('roles')
)
INSERT INTO public.role_permissions (role, page, can_view, can_create, can_edit, can_delete, can_export)
SELECT 'hr'::public.app_role, slug,
  true,
  slug IN ('employees','leaves','leaves-requests','payroll','holidays','holiday-types','contracts','kpis','allowances','late-penalties','targets-overtime','shifts','attendance'),
  slug IN ('employees','leaves','leaves-requests','payroll','holidays','holiday-types','contracts','kpis','allowances','late-penalties','targets-overtime','shifts','attendance','directory'),
  slug IN ('employees','leaves','holidays','holiday-types','contracts','kpis','allowances','late-penalties','targets-overtime','shifts'),
  slug IN ('employees','attendance','leaves','payroll','contracts','reports','directory')
FROM pages
ON CONFLICT (role, page) DO NOTHING;

WITH pages(slug) AS (VALUES
  ('employees'),('attendance'),('leaves'),('leaves-requests'),('payroll'),
  ('holidays'),('holiday-types'),('contracts'),('kpis'),('allowances'),
  ('late-penalties'),('targets-overtime'),('shifts'),('networks'),('geofencing'),
  ('directory'),('employee-access'),('audit'),('reports'),('settings'),('roles')
)
INSERT INTO public.role_permissions (role, page, can_view, can_create, can_edit, can_delete, can_export)
SELECT 'manager'::public.app_role, slug,
  slug IN ('employees','attendance','leaves','leaves-requests','directory','reports','kpis','targets-overtime','shifts'),
  slug IN ('leaves-requests'),
  slug IN ('attendance','leaves-requests','kpis','targets-overtime'),
  false,
  slug IN ('attendance','leaves','reports')
FROM pages
ON CONFLICT (role, page) DO NOTHING;

WITH pages(slug) AS (VALUES
  ('employees'),('attendance'),('leaves'),('leaves-requests'),('payroll'),
  ('holidays'),('holiday-types'),('contracts'),('kpis'),('allowances'),
  ('late-penalties'),('targets-overtime'),('shifts'),('networks'),('geofencing'),
  ('directory'),('employee-access'),('audit'),('reports'),('settings'),('roles')
)
INSERT INTO public.role_permissions (role, page, can_view, can_create, can_edit, can_delete, can_export)
SELECT 'user'::public.app_role, slug,
  slug IN ('directory'),
  false, false, false, false
FROM pages
ON CONFLICT (role, page) DO NOTHING;


-- 20260608164723_9b04ba66-a4fa-438c-a5c9-a9d7871e9cab.sql

ALTER TABLE public.cities ADD CONSTRAINT cities_name_en_unique UNIQUE (name_en);
ALTER TABLE public.districts ADD CONSTRAINT districts_city_name_en_unique UNIQUE (city_id, name_en);


-- 20260608170354_d383bc31-411d-4926-b8a5-231f48ca79c1.sql
CREATE TABLE IF NOT EXISTS public.security_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  enforce_2fa boolean NOT NULL DEFAULT false,
  session_timeout_minutes integer NOT NULL DEFAULT 480,
  ip_allowlist text[] NOT NULL DEFAULT '{}',
  rate_limit_per_min integer NOT NULL DEFAULT 120,
  csp_enabled boolean NOT NULL DEFAULT true,
  hsts_enabled boolean NOT NULL DEFAULT true,
  x_frame_deny boolean NOT NULL DEFAULT true,
  referrer_policy text NOT NULL DEFAULT 'strict-origin-when-cross-origin',
  permissions_policy text NOT NULL DEFAULT 'camera=(), microphone=(), geolocation=(self)',
  block_sql_keywords boolean NOT NULL DEFAULT true,
  sanitize_html_inputs boolean NOT NULL DEFAULT true,
  cdn_subresource_integrity boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT security_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.security_settings TO authenticated;
GRANT ALL ON public.security_settings TO service_role;

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_settings_admin_select" ON public.security_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "security_settings_admin_insert" ON public.security_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "security_settings_admin_update" ON public.security_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.security_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER security_settings_set_updated_at
  BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 20260608174626_62e12460-7239-4b51-adda-9dc3af55cc41.sql

-- Staff role can read/update attendance for any employee
CREATE POLICY "att staff read" ON public.attendance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "att staff update" ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "att staff insert" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "att staff delete" ON public.attendance
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

-- Staff role can read/update leaves for any employee
CREATE POLICY "leaves staff read" ON public.leaves
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "leaves staff update" ON public.leaves
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));


-- 20260609175810_02515946-cbfd-4251-87ed-cb1246977a46.sql

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_leave_balances_for_employee() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_leave_balances_for_type() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_leave_balance_change() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.smtp_config_decrypt(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smtp_config_set_password(text, text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.import_employee_profile(text, text, text, public.app_role, text, text, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.import_employee_profile(text, text, text, public.app_role, text, text, uuid, uuid, text, text) TO authenticated;


-- 20260609180518_3a91e8d7-d74e-44b6-9dea-0dd0bb996c1c.sql

create or replace function public.security_scan_query(_sql text)
returns setof jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare r record;
begin
  for r in execute 'select to_jsonb(t) as j from (' || _sql || ') t' loop
    return next r.j;
  end loop;
  return;
end;
$$;

create or replace function public.security_scan_exec(_sql text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  execute _sql;
end;
$$;

revoke execute on function public.security_scan_query(text) from public;
revoke execute on function public.security_scan_exec(text)  from public;
grant  execute on function public.security_scan_query(text) to service_role;
grant  execute on function public.security_scan_exec(text)  to service_role;


-- 20260610160512_c54fcf07-547c-4db0-b359-e0875e4adcc6.sql
ALTER TABLE public.leaves
  ADD COLUMN IF NOT EXISTS proof_url  text,
  ADD COLUMN IF NOT EXISTS proof_mime text,
  ADD COLUMN IF NOT EXISTS proof_name text;

-- 20260610171817_b39824cd-ef5b-454f-a844-5bd13402a62b.sql
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS requires_proof boolean NOT NULL DEFAULT false;
UPDATE public.leave_types SET requires_proof = true WHERE lower(name) LIKE '%sick%' AND requires_proof = false;

-- 20260610173655_131ca41d-297e-47b7-8e8a-77dab6bca983.sql

CREATE TABLE public.security_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'manual',
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  hit_count integer NOT NULL DEFAULT 0,
  manual boolean NOT NULL DEFAULT true,
  created_by uuid,
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_blocklist TO authenticated;
GRANT ALL ON public.security_blocklist TO service_role;
ALTER TABLE public.security_blocklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read blocklist" ON public.security_blocklist FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write blocklist" ON public.security_blocklist FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX security_blocklist_ip_idx ON public.security_blocklist(ip);

CREATE TABLE public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  path text,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_audit_events TO authenticated;
GRANT ALL ON public.security_audit_events TO service_role;
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit events" ON public.security_audit_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX security_audit_events_created_idx ON public.security_audit_events(created_at DESC);
CREATE INDEX security_audit_events_ip_idx ON public.security_audit_events(ip);


-- 20260613001517_3603d507-5124-4447-bdca-ef0973a0a01b.sql
REVOKE EXECUTE ON FUNCTION public.security_scan_query(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.security_scan_exec(text) FROM anon, PUBLIC;

-- 20260613001702_80070bfc-d2ca-4e1f-87d5-085a4cb9560a.sql
REVOKE EXECUTE ON FUNCTION public.security_scan_query(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.security_scan_exec(text) FROM authenticated;

-- 20260617100407_5e5682d5-98da-44a6-a988-f762b7711723.sql

-- ========== payroll_settings ==========
CREATE TABLE public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_insurance_rate numeric(6,5) NOT NULL,
  employer_insurance_rate numeric(6,5) NOT NULL,
  martyrs_fund_rate numeric(6,5) NOT NULL DEFAULT 0,
  martyrs_fund_enabled boolean NOT NULL DEFAULT true,
  insurance_ceiling numeric(12,2) NOT NULL,
  insurance_floor numeric(12,2) NOT NULL DEFAULT 0,
  annual_personal_exemption numeric(12,2) NOT NULL DEFAULT 0,
  effective_date date NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payroll_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payroll_settings TO authenticated;
GRANT ALL ON public.payroll_settings TO service_role;

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read payroll settings"
  ON public.payroll_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/HR can write payroll settings"
  ON public.payroll_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE TRIGGER tg_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ========== tax_brackets ==========
CREATE TABLE public.tax_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL,
  from_amount numeric(14,2) NOT NULL,
  to_amount numeric(14,2),   -- NULL = infinity
  tax_rate numeric(6,5) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tax_brackets_effective_idx ON public.tax_brackets (effective_date, from_amount);

GRANT SELECT ON public.tax_brackets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tax_brackets TO authenticated;
GRANT ALL ON public.tax_brackets TO service_role;

ALTER TABLE public.tax_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tax brackets"
  ON public.tax_brackets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/HR can write tax brackets"
  ON public.tax_brackets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

-- ========== profiles columns ==========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salary_type text NOT NULL DEFAULT 'GROSS' CHECK (salary_type IN ('NET','GROSS')),
  ADD COLUMN IF NOT EXISTS salary_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_applicable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_applicable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS martyrs_fund_applicable boolean NOT NULL DEFAULT true;

-- backfill salary_amount from existing salary_gross/net where possible
UPDATE public.profiles
  SET salary_type  = COALESCE(UPPER(salary_mode), 'GROSS'),
      salary_amount = COALESCE(
        CASE WHEN UPPER(COALESCE(salary_mode,'GROSS'))='NET' THEN salary_net ELSE salary_gross END,
        salary_gross, salary_net, 0
      )
  WHERE salary_amount = 0;

-- ========== seed Egyptian 2024 defaults ==========
INSERT INTO public.payroll_settings
  (employee_insurance_rate, employer_insurance_rate, martyrs_fund_rate, martyrs_fund_enabled,
   insurance_ceiling, insurance_floor, annual_personal_exemption, effective_date, notes)
VALUES
  (0.11, 0.1875, 0.0005, true, 12600, 2000, 20000, '2024-01-01',
   'Egyptian payroll defaults — 2024');

INSERT INTO public.tax_brackets (effective_date, from_amount, to_amount, tax_rate) VALUES
  ('2024-01-01',      0,    40000, 0.000),
  ('2024-01-01',  40000,    55000, 0.100),
  ('2024-01-01',  55000,    70000, 0.150),
  ('2024-01-01',  70000,   200000, 0.200),
  ('2024-01-01', 200000,   400000, 0.225),
  ('2024-01-01', 400000,  1200000, 0.250),
  ('2024-01-01', 1200000,    NULL, 0.275);


-- 20260617121105_f66be0d8-0fa4-4904-ad41-cf85b6ba95ac.sql

-- 1) Face descriptors (one per user)
CREATE TABLE public.face_descriptors (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  descriptor jsonb NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.face_descriptors TO authenticated;
GRANT ALL ON public.face_descriptors TO service_role;
ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own face" ON public.face_descriptors
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin hr view face" ON public.face_descriptors
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE TRIGGER trg_face_descriptors_updated
  BEFORE UPDATE ON public.face_descriptors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) WebAuthn credentials (fingerprint / platform authenticators)
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_id text UNIQUE NOT NULL,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX idx_webauthn_creds_user ON public.webauthn_credentials(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own webauthn" ON public.webauthn_credentials
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin hr view webauthn" ON public.webauthn_credentials
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- 3) WebAuthn challenges (server-only)
CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text,
  challenge text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('register','authenticate')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webauthn_challenges_expiry ON public.webauthn_challenges(expires_at);
GRANT ALL ON public.webauthn_challenges TO service_role;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon: only service_role (server functions) may touch this.

-- 4) Attendance verification flags
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS verified_face boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_fp   boolean NOT NULL DEFAULT false;


-- 20260617181040_a707198b-3094-4c4c-99ff-082121cf2473.sql

CREATE TABLE public.employee_devices (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Device',
  user_agent text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE INDEX employee_devices_user_id_idx ON public.employee_devices(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_devices TO authenticated;
GRANT ALL ON public.employee_devices TO service_role;

ALTER TABLE public.employee_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own devices"
  ON public.employee_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Users register own devices"
  ON public.employee_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins/HR manage devices"
  ON public.employee_devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Users or admins delete devices"
  ON public.employee_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER employee_devices_updated_at
  BEFORE UPDATE ON public.employee_devices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 20260617200519_c0e17bd2-3152-4254-82d1-a6bdd2f3ae27.sql
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- 20260617205556_a5a125fe-0232-4f9d-b7de-d208f552982c.sql
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS out_lat double precision,
  ADD COLUMN IF NOT EXISTS out_lng double precision,
  ADD COLUMN IF NOT EXISTS out_city text,
  ADD COLUMN IF NOT EXISTS out_district text,
  ADD COLUMN IF NOT EXISTS out_street text;

-- 20260617210334_86f7291c-5973-434a-8088-927f5efd4749.sql

-- Manager reassignment history
CREATE TABLE IF NOT EXISTS public.manager_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  new_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mah_employee ON public.manager_assignment_history(employee_id, created_at DESC);

GRANT SELECT ON public.manager_assignment_history TO authenticated;
GRANT ALL ON public.manager_assignment_history TO service_role;

ALTER TABLE public.manager_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HR can view manager history"
  ON public.manager_assignment_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Employee can view their own manager history"
  ON public.manager_assignment_history FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Payroll settings: pay period + payout methods
ALTER TABLE public.payroll_settings
  ADD COLUMN IF NOT EXISTS pay_period text NOT NULL DEFAULT 'Monthly',
  ADD COLUMN IF NOT EXISTS payout_methods text[] NOT NULL DEFAULT ARRAY['Bank Transfer']::text[];


-- 20260618200914_0dec48cc-b86f-4ffa-a54b-1b390561b936.sql
CREATE TABLE public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  body text not null default '',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/HR can manage contract templates"
ON public.contract_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Authenticated can read active templates"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 20260618212711_2efd7583-82a6-4784-8a83-14fef5ffad85.sql
CREATE OR REPLACE FUNCTION public.apply_leave_balance_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  yr integer := EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date))::int;
  was_approved boolean := (TG_OP = 'UPDATE' AND OLD.status = 'approved');
  is_approved  boolean := (TG_OP <> 'DELETE' AND NEW.status = 'approved');
  resolved_type_id uuid;
  old_type_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_type_id := OLD.leave_type_id;
    IF old_type_id IS NULL AND OLD.leave_type_name IS NOT NULL THEN
      SELECT id INTO old_type_id FROM public.leave_types
        WHERE active = true AND lower(name) = lower(OLD.leave_type_name) LIMIT 1;
    END IF;
    IF OLD.status = 'approved' AND old_type_id IS NOT NULL THEN
      UPDATE public.leave_balances SET used_days = GREATEST(0, used_days - OLD.days)
      WHERE employee_id = OLD.employee_id AND leave_type_id = old_type_id AND year = yr;
    END IF;
    RETURN OLD;
  END IF;

  resolved_type_id := NEW.leave_type_id;
  IF resolved_type_id IS NULL AND NEW.leave_type_name IS NOT NULL THEN
    SELECT id INTO resolved_type_id FROM public.leave_types
      WHERE active = true AND lower(name) = lower(NEW.leave_type_name) LIMIT 1;
  END IF;

  IF resolved_type_id IS NULL THEN RETURN NEW; END IF;

  IF is_approved AND NOT was_approved THEN
    INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days, used_days)
    VALUES (NEW.employee_id, resolved_type_id, yr, 0, NEW.days)
    ON CONFLICT (employee_id, leave_type_id, year)
    DO UPDATE SET used_days = public.leave_balances.used_days + NEW.days;
  ELSIF was_approved AND NOT is_approved THEN
    old_type_id := COALESCE(OLD.leave_type_id, resolved_type_id);
    UPDATE public.leave_balances SET used_days = GREATEST(0, used_days - OLD.days)
    WHERE employee_id = OLD.employee_id AND leave_type_id = old_type_id AND year = yr;
  END IF;
  RETURN NEW;
END $function$;

-- 20260618214319_65b2d8f9-b89c-4f5f-9c2a-09ee37dc91c5.sql
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.positions   ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill: order by name_en so existing rows have stable initial order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name_en NULLS LAST, created_at) * 10 AS rn
  FROM public.departments
)
UPDATE public.departments d SET sort_order = r.rn FROM ranked r WHERE d.id = r.id AND d.sort_order = 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name_en NULLS LAST, created_at) * 10 AS rn
  FROM public.positions
)
UPDATE public.positions p SET sort_order = r.rn FROM ranked r WHERE p.id = r.id AND p.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_departments_sort_order ON public.departments(sort_order);
CREATE INDEX IF NOT EXISTS idx_positions_sort_order ON public.positions(sort_order);

-- 20260618231404_270b9a1f-7861-4282-99e4-21a15c6f9ff7.sql

-- Employee assignment junction tables for KPIs, Allowances, Targets & Overtime, Shifts

-- KPIs
CREATE TABLE public.employee_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, kpi_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_kpis TO authenticated;
GRANT ALL ON public.employee_kpis TO service_role;
ALTER TABLE public.employee_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR manage employee_kpis" ON public.employee_kpis FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Employees view own kpis" ON public.employee_kpis FOR SELECT
  USING (employee_id = auth.uid());

-- Allowances
CREATE TABLE public.employee_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  allowance_id uuid NOT NULL REFERENCES public.allowances(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, allowance_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_allowances TO authenticated;
GRANT ALL ON public.employee_allowances TO service_role;
ALTER TABLE public.employee_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR manage employee_allowances" ON public.employee_allowances FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Employees view own allowances" ON public.employee_allowances FOR SELECT
  USING (employee_id = auth.uid());

-- Targets & Overtime
CREATE TABLE public.employee_targets_overtime (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  targets_overtime_id uuid NOT NULL REFERENCES public.targets_overtime(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, targets_overtime_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_targets_overtime TO authenticated;
GRANT ALL ON public.employee_targets_overtime TO service_role;
ALTER TABLE public.employee_targets_overtime ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR manage employee_targets_overtime" ON public.employee_targets_overtime FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Employees view own targets_overtime" ON public.employee_targets_overtime FOR SELECT
  USING (employee_id = auth.uid());

-- Shifts
CREATE TABLE public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, shift_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_shifts TO authenticated;
GRANT ALL ON public.employee_shifts TO service_role;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR manage employee_shifts" ON public.employee_shifts FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Employees view own shifts" ON public.employee_shifts FOR SELECT
  USING (employee_id = auth.uid());

CREATE INDEX idx_employee_kpis_employee ON public.employee_kpis(employee_id);
CREATE INDEX idx_employee_allowances_employee ON public.employee_allowances(employee_id);
CREATE INDEX idx_employee_targets_overtime_employee ON public.employee_targets_overtime(employee_id);
CREATE INDEX idx_employee_shifts_employee ON public.employee_shifts(employee_id);


-- 20260717000000_manpower-module.sql
-- ============================================================
-- Combined Migration: job_grades + department_positions + sections + manpower_plans + gender
-- ============================================================

-- 1. Job Grades table
CREATE TABLE IF NOT EXISTS public.job_grades (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name_en text NOT NULL,
    name_ar text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT job_grades_pkey PRIMARY KEY (id)
);

ALTER TABLE public.job_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.job_grades;
CREATE POLICY "Enable read access for authenticated users" ON public.job_grades
    AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable all access for admin users" ON public.job_grades;
CREATE POLICY "Enable all access for admin users" ON public.job_grades
    AS PERMISSIVE FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP TRIGGER IF EXISTS set_job_grades_updated_at ON public.job_grades;
CREATE TRIGGER set_job_grades_updated_at BEFORE UPDATE ON public.job_grades
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed G01-G15 grades
INSERT INTO public.job_grades (name_en, name_ar) VALUES
    ('G01 - Trainee', 'G01 - متدرب'),
    ('G02 - Junior Staff', 'G02 - موظف مبتدئ'),
    ('G03 - Officer', 'G03 - مسؤول'),
    ('G04 - Senior Officer', 'G04 - مسؤول أول'),
    ('G05 - Specialist', 'G05 - متخصص'),
    ('G06 - Senior Specialist', 'G06 - متخصص أول'),
    ('G07 - Team Leader', 'G07 - قائد فريق'),
    ('G08 - Supervisor', 'G08 - مشرف'),
    ('G09 - Assistant Manager', 'G09 - مساعد مدير'),
    ('G10 - Manager', 'G10 - مدير'),
    ('G11 - Senior Manager', 'G11 - مدير أول'),
    ('G12 - Department Head', 'G12 - رئيس قسم'),
    ('G13 - Director', 'G13 - مدير عام'),
    ('G14 - Executive Director', 'G14 - مدير تنفيذي'),
    ('G15 - CEO', 'G15 - رئيس تنفيذي')
ON CONFLICT DO NOTHING;

-- 2. Sections table
CREATE TABLE IF NOT EXISTS public.sections (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name_en text NOT NULL,
    name_ar text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sections_pkey PRIMARY KEY (id)
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.sections;
CREATE POLICY "Enable read access for authenticated users" ON public.sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.sections;
CREATE POLICY "Enable all access for admin users" ON public.sections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
DROP TRIGGER IF EXISTS set_sections_updated_at ON public.sections;
CREATE TRIGGER set_sections_updated_at BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Link Sections to Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL;

-- 4. Add gender to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female') OR gender IS NULL);

-- 5. Department Positions table
CREATE TABLE IF NOT EXISTS public.department_positions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    job_grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,
    section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
    headcount integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT department_positions_pkey PRIMARY KEY (id),
    CONSTRAINT department_positions_unique_dept_pos UNIQUE (department_id, position_id)
);

ALTER TABLE public.department_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.department_positions;
CREATE POLICY "Enable read access for authenticated users" ON public.department_positions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.department_positions;
CREATE POLICY "Enable all access for admin users" ON public.department_positions AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
DROP TRIGGER IF EXISTS set_department_positions_updated_at ON public.department_positions;
CREATE TRIGGER set_department_positions_updated_at BEFORE UPDATE ON public.department_positions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Manpower Plans table
CREATE TABLE IF NOT EXISTS public.manpower_plans (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    fiscal_year integer NOT NULL,
    company text,
    branch text,
    department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
    section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
    position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
    job_grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,

    planned_headcount integer NOT NULL DEFAULT 1,

    employment_type text CHECK (employment_type IN ('Full-Time', 'Part-Time', 'Contract', 'Temporary', 'Internship')),
    hiring_reason text,
    priority text CHECK (priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
    required_date date,

    salary_from numeric,
    salary_to numeric,
    currency text DEFAULT 'EGP',

    budget_available boolean DEFAULT false,
    budget_approved boolean DEFAULT false,
    cost_center text,
    estimated_annual_cost numeric,

    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Dept Manager', 'Pending HR', 'Pending Finance', 'Pending Executive', 'Approved', 'Rejected', 'Closed')),
    notes text,

    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT manpower_plans_pkey PRIMARY KEY (id)
);

ALTER TABLE public.manpower_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.manpower_plans;
CREATE POLICY "Enable read access for authenticated users" ON public.manpower_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.manpower_plans;
CREATE POLICY "Enable all access for admin users" ON public.manpower_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
DROP TRIGGER IF EXISTS set_manpower_plans_updated_at ON public.manpower_plans;
CREATE TRIGGER set_manpower_plans_updated_at BEFORE UPDATE ON public.manpower_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7. View: current headcount per position/department/section
CREATE OR REPLACE VIEW public.vw_current_headcount AS
SELECT
    department_id,
    section_id,
    position_id,
    COUNT(id) AS current_headcount
FROM public.profiles
WHERE status = 'ACTIVE'
  AND department_id IS NOT NULL
  AND position_id IS NOT NULL
GROUP BY department_id, section_id, position_id;


-- 20260717125902_017-profile-enhancements.sql


-- 20260717130000_profile_enhancements.sql
-- Phase 1 Profile Enhancements

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS extra_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS medical_insurance_details TEXT,
ADD COLUMN IF NOT EXISTS is_insured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS military_expire_date DATE,
ADD COLUMN IF NOT EXISTS is_five_percent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS social_insurance_date DATE,
ADD COLUMN IF NOT EXISTS custom_field TEXT,
ADD COLUMN IF NOT EXISTS last_action_date TIMESTAMP WITH TIME ZONE;


-- 20260717140000_attendance_overrides.sql
-- Add a date column to allow working on leaves/holidays/weekends
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approved_work_date DATE;


-- 20260717150000_leave_types_cleanup.sql
-- Phase 3: Leave Types Cleanup
-- Deactivate all old leave types
UPDATE public.leave_types SET active = false;

DO $$ 
DECLARE
    lt text;
    types text[] := ARRAY['Annual leaves', 'Emergency leaves', 'Unpaid Leaves', 'Sick leaves', 'Holidays', 'Site leave'];
BEGIN
    FOREACH lt IN ARRAY types
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.leave_types WHERE name = lt) THEN
            INSERT INTO public.leave_types (name, annual_days, paid, active, requires_proof)
            VALUES (
                lt,
                CASE lt WHEN 'Annual leaves' THEN 21 WHEN 'Emergency leaves' THEN 6 WHEN 'Sick leaves' THEN 15 ELSE 0 END,
                CASE lt WHEN 'Unpaid Leaves' THEN false ELSE true END,
                true,
                CASE lt WHEN 'Sick leaves' THEN true ELSE false END
            );
        END IF;
    END LOOP;
END $$;

-- If they already exist but were deactivated, reactivate them:
UPDATE public.leave_types 
SET active = true 
WHERE name IN ('Annual leaves', 'Emergency leaves', 'Unpaid Leaves', 'Sick leaves', 'Holidays', 'Site leave');


-- 20260717160000_department_transfers.sql
CREATE TABLE IF NOT EXISTS public.department_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  new_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  old_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  new_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  old_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  new_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  effective_date DATE NOT NULL,
  note TEXT,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.department_transfers TO authenticated;
GRANT ALL ON public.department_transfers TO service_role;
ALTER TABLE public.department_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/HR view transfers" ON public.department_transfers 
  FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR employee_id = auth.uid());

CREATE POLICY "Admins/HR insert transfers" ON public.department_transfers 
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));


-- 20260717170000_payroll_enhancements.sql
-- Phase 4: Payroll Breakdown & Offboarding

-- 1. Profiles enhancements for payroll
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS insurance_salary numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS emergency_fund numeric(14,2) NOT NULL DEFAULT 0;

-- 2. Payroll items enhancements
ALTER TABLE public.payroll_run_items
ADD COLUMN IF NOT EXISTS gross_salary numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_salary numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS basic_salary numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS insurance_salary numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS emergency_fund numeric(14,2) NOT NULL DEFAULT 0;

-- 3. Offboarding / Final Settlements
CREATE TABLE IF NOT EXISTS public.final_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resignation_date date NOT NULL,
  
  -- Unpaid salary calculation
  worked_days integer NOT NULL DEFAULT 0,
  daily_rate numeric(14,2) NOT NULL DEFAULT 0,
  unpaid_salary numeric(14,2) NOT NULL DEFAULT 0,
  
  -- Leaves
  remaining_leave_days numeric(14,2) NOT NULL DEFAULT 0,
  leave_cash_out numeric(14,2) NOT NULL DEFAULT 0,
  
  -- Advances / Loans deductions
  outstanding_advances numeric(14,2) NOT NULL DEFAULT 0,
  
  -- Extras
  other_additions numeric(14,2) NOT NULL DEFAULT 0,
  other_deductions numeric(14,2) NOT NULL DEFAULT 0,
  
  -- Total
  net_settlement numeric(14,2) GENERATED ALWAYS AS (
    unpaid_salary + leave_cash_out + other_additions - outstanding_advances - other_deductions
  ) STORED,
  
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.final_settlements TO authenticated;
GRANT ALL ON public.final_settlements TO service_role;
ALTER TABLE public.final_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage settlements" ON public.final_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_final_settlements_updated
  BEFORE UPDATE ON public.final_settlements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 20260717180000_advanced_payroll_settings.sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS external_income numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS external_tax_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS medical_insurance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_deductions numeric DEFAULT 0;


-- 20260717190000_bank_and_insurance.sql
��- -   A d d   i n s u r a n c e   a n d   b a n k   i n f o   t o   p r o f i l e s 
 A L T E R   T A B L E   p u b l i c . p r o f i l e s 
 A D D   C O L U M N   I F   N O T   E X I S T S   i n s u r a n c e _ n u m b e r   t e x t , 
 A D D   C O L U M N   I F   N O T   E X I S T S   b a n k _ a c c o u n t _ n a m e   t e x t , 
 A D D   C O L U M N   I F   N O T   E X I S T S   b a n k _ a c c o u n t _ n u m b e r   t e x t ; 
  
 

-- 20260719104943_add_annual_advance_limit.sql
alter table public.profiles
add column if not exists annual_advance_limit numeric default 10000 not null;


