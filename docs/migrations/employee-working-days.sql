-- Per-employee working-days configuration.
--   • one row with scope='weekly' for the default weekday pattern (0=Sun..6=Sat)
--   • optional rows with scope='month' overriding a specific (year, month)
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.employee_working_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('weekly','month')),
  year int,
  month int,
  days int[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_working_days_month_range CHECK (month IS NULL OR (month BETWEEN 1 AND 12)),
  CONSTRAINT employee_working_days_scope_shape CHECK (
    (scope = 'weekly' AND year IS NULL AND month IS NULL)
    OR (scope = 'month' AND year IS NOT NULL AND month IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_working_days TO authenticated;
GRANT ALL ON public.employee_working_days TO service_role;

ALTER TABLE public.employee_working_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins/HR manage employee_working_days" ON public.employee_working_days;
CREATE POLICY "Admins/HR manage employee_working_days" ON public.employee_working_days FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "Employees view own working_days" ON public.employee_working_days;
CREATE POLICY "Employees view own working_days" ON public.employee_working_days FOR SELECT
  USING (employee_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS uniq_employee_working_days_weekly
  ON public.employee_working_days(employee_id) WHERE scope = 'weekly';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employee_working_days_month
  ON public.employee_working_days(employee_id, year, month) WHERE scope = 'month';
CREATE INDEX IF NOT EXISTS idx_employee_working_days_employee
  ON public.employee_working_days(employee_id);

DROP TRIGGER IF EXISTS trg_employee_working_days_updated_at ON public.employee_working_days;
CREATE TRIGGER trg_employee_working_days_updated_at
  BEFORE UPDATE ON public.employee_working_days
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();