
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
