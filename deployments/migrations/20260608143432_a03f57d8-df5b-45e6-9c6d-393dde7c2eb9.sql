
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
