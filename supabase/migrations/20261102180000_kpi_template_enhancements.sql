-- ==============================================================================
-- Migration: KPI Template Enhancements, Directional Scoring & Employee Privacy
-- Scope:
--   1. Add department_id, description, effective_year/quarter to kpi_templates
--   2. Add scoring_direction, unit, min_value, max_value to kpi_criteria
--   3. Add scoring_direction and unit to kpi_template_items and kpi_quarterly_items
--   4. Update employee RLS to strictly allow reading ONLY approved evaluations
-- ==============================================================================

-- 1. Enhance kpi_templates with department linkage and effective scope
ALTER TABLE public.kpi_templates
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS effective_year integer DEFAULT 2026,
  ADD COLUMN IF NOT EXISTS effective_quarter text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS parent_template_id uuid REFERENCES public.kpi_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_templates_dept ON public.kpi_templates (department_id, position_id, job_grade_id);

-- 2. Enhance kpi_criteria with scoring direction and measurement unit
ALTER TABLE public.kpi_criteria
  ADD COLUMN IF NOT EXISTS scoring_direction text DEFAULT 'higher_is_better',
  ADD COLUMN IF NOT EXISTS unit text DEFAULT '%',
  ADD COLUMN IF NOT EXISTS min_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_value numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS how_measured_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS how_measured_ar text DEFAULT '';

-- 3. Enhance template items with line-level direction and unit overrides
ALTER TABLE public.kpi_template_items
  ADD COLUMN IF NOT EXISTS scoring_direction text DEFAULT 'higher_is_better',
  ADD COLUMN IF NOT EXISTS unit text DEFAULT '%',
  ADD COLUMN IF NOT EXISTS min_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_value numeric DEFAULT 100;

-- 4. Enhance quarterly snapshot items with direction and unit
ALTER TABLE public.kpi_quarterly_items
  ADD COLUMN IF NOT EXISTS scoring_direction text DEFAULT 'higher_is_better',
  ADD COLUMN IF NOT EXISTS unit text DEFAULT '%';

-- 5. Tighten Employee RLS Policy: Employees may view ONLY approved evaluations
DROP POLICY IF EXISTS "kpi_quarterly_emp_read" ON public.kpi_quarterly_evaluations;
CREATE POLICY "kpi_quarterly_emp_read" ON public.kpi_quarterly_evaluations FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    AND status = 'approved'
  );

-- Also ensure quarterly items inherit this strict visibility for employees
DROP POLICY IF EXISTS "kpi_quarterly_items_emp_read" ON public.kpi_quarterly_items;
CREATE POLICY "kpi_quarterly_items_emp_read" ON public.kpi_quarterly_items FOR SELECT TO authenticated
  USING (
    evaluation_id IN (
      SELECT id FROM public.kpi_quarterly_evaluations
      WHERE employee_id = auth.uid() AND status = 'approved'
    )
  );

