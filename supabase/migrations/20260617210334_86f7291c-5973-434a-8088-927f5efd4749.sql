
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
