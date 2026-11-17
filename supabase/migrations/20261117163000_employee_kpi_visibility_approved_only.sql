-- Migration: Restrict employee KPI evaluation read access to approved evaluations only
-- Description: Employees should only view KPI evaluations and scorecards AFTER HR or Admin approval,
--              not immediately upon manager submission.

-- 1. Tighten Employee RLS Policy on kpi_evaluations
DROP POLICY IF EXISTS "kpi_eval_employee_read" ON public.kpi_evaluations;
CREATE POLICY "kpi_eval_employee_read" ON public.kpi_evaluations
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid() 
    AND status = 'approved'
  );

-- 2. Tighten Employee RLS Policy on kpi_quarterly_evaluations
DROP POLICY IF EXISTS "kpi_quarterly_emp_read" ON public.kpi_quarterly_evaluations;
CREATE POLICY "kpi_quarterly_emp_read" ON public.kpi_quarterly_evaluations
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    AND status = 'approved'
  );

-- 3. Tighten Employee RLS Policy on kpi_quarterly_items
DROP POLICY IF EXISTS "kpi_quarterly_items_emp_read" ON public.kpi_quarterly_items;
CREATE POLICY "kpi_quarterly_items_emp_read" ON public.kpi_quarterly_items
  FOR SELECT TO authenticated
  USING (
    evaluation_id IN (
      SELECT id FROM public.kpi_quarterly_evaluations
      WHERE employee_id = auth.uid() AND status = 'approved'
    )
  );
