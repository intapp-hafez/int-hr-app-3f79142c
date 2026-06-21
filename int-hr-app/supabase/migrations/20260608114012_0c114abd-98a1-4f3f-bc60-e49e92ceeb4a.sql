
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
