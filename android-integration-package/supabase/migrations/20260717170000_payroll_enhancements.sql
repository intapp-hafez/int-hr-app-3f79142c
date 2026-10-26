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
