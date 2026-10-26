-- Migration: Employee Penalties Module
-- Stores disciplinary / financial penalties for employees with dates, reasons, payment status, and status lifecycle.

CREATE TABLE IF NOT EXISTS public.employee_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  penalty_date DATE NOT NULL DEFAULT CURRENT_DATE,
  penalty_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_employee_penalties_emp ON public.employee_penalties(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_penalties_date ON public.employee_penalties(penalty_date);
CREATE INDEX IF NOT EXISTS idx_employee_penalties_status ON public.employee_penalties(status);

-- Enable Row Level Security
ALTER TABLE public.employee_penalties ENABLE ROW LEVEL SECURITY;

-- Admins, HR, and Finance can view all penalties
DROP POLICY IF EXISTS "Admins and HR can view employee penalties" ON public.employee_penalties;
CREATE POLICY "Admins and HR can view employee penalties"
  ON public.employee_penalties
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'finance')
    OR employee_id = auth.uid()
  );

-- Admins and HR can insert penalties
DROP POLICY IF EXISTS "Admins and HR can insert employee penalties" ON public.employee_penalties;
CREATE POLICY "Admins and HR can insert employee penalties"
  ON public.employee_penalties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'finance')
  );

-- Admins and HR can update penalties
DROP POLICY IF EXISTS "Admins and HR can update employee penalties" ON public.employee_penalties;
CREATE POLICY "Admins and HR can update employee penalties"
  ON public.employee_penalties
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'finance')
  );

-- Admins and HR can delete penalties
DROP POLICY IF EXISTS "Admins and HR can delete employee penalties" ON public.employee_penalties;
CREATE POLICY "Admins and HR can delete employee penalties"
  ON public.employee_penalties
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
  );
