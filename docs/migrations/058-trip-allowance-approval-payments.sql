-- Run AFTER 056 and 057. Safe to re-run.
-- Adds manager approval + trip details to monthly trip allowances, and a payroll payments table with history.
ALTER TABLE public.monthly_trip_allowances
  ADD COLUMN IF NOT EXISTS trip_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manager_trips_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_approved_by uuid,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Managers can read and approve their own team's rows.
DROP POLICY IF EXISTS "mta manager read" ON public.monthly_trip_allowances;
CREATE POLICY "mta manager read" ON public.monthly_trip_allowances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = employee_id AND p.manager_id = auth.uid()));
DROP POLICY IF EXISTS "mta manager approve" ON public.monthly_trip_allowances;
CREATE POLICY "mta manager approve" ON public.monthly_trip_allowances FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = employee_id AND p.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = employee_id AND p.manager_id = auth.uid())
    AND status IN ('draft','manager_approved'));

CREATE TABLE IF NOT EXISTS public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  trip_allowance numeric NOT NULL DEFAULT 0,
  other_earnings numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','paid','cancelled')),
  method text,
  reference text,
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  paid_by uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_payments TO authenticated;
GRANT ALL ON public.payroll_payments TO service_role;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp staff manage" ON public.payroll_payments;
CREATE POLICY "pp staff manage" ON public.payroll_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'finance'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'finance'));
DROP POLICY IF EXISTS "pp own read" ON public.payroll_payments;
CREATE POLICY "pp own read" ON public.payroll_payments FOR SELECT TO authenticated USING (employee_id = auth.uid());
DROP TRIGGER IF EXISTS pp_updated_at ON public.payroll_payments;
CREATE TRIGGER pp_updated_at BEFORE UPDATE ON public.payroll_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
