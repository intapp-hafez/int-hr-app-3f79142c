-- ==============================================================================
-- Migration: KPI Annual Evaluations Table & Access Control (RLS)
-- Allowed for: Admin, HR, and Managers (with team scoping)
-- Timezone: Africa/Cairo
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.kpi_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluation_year integer NOT NULL CHECK (evaluation_year >= 2020 AND evaluation_year <= 2100),
  template_type text NOT NULL DEFAULT 'light_current_engineer',
  evaluator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  evaluator_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved')),
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz DEFAULT NULL,
  reviewed_at timestamptz DEFAULT NULL,
  approved_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT kpi_eval_unique_record UNIQUE (employee_id, evaluation_year, template_type)
);

CREATE INDEX IF NOT EXISTS idx_kpi_eval_emp_year 
  ON public.kpi_evaluations (employee_id, evaluation_year);

CREATE INDEX IF NOT EXISTS idx_kpi_eval_status 
  ON public.kpi_evaluations (status);

CREATE INDEX IF NOT EXISTS idx_kpi_eval_evaluator 
  ON public.kpi_evaluations (evaluator_id);

CREATE INDEX IF NOT EXISTS idx_kpi_eval_year 
  ON public.kpi_evaluations (evaluation_year);

-- Enable Row Level Security
ALTER TABLE public.kpi_evaluations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.kpi_evaluations TO authenticated, service_role;

-- 1. Admin and HR Full Access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "kpi_eval_admin_all" ON public.kpi_evaluations;
CREATE POLICY "kpi_eval_admin_all" ON public.kpi_evaluations
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'hr')
  );

-- 2. Manager Read Access:
-- Managers can view evaluations they created OR evaluations for employees reporting to them
DROP POLICY IF EXISTS "kpi_eval_manager_read" ON public.kpi_evaluations;
CREATE POLICY "kpi_eval_manager_read" ON public.kpi_evaluations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND (
      evaluator_id = auth.uid()
      OR employee_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.manager_id = auth.uid()
           OR p.department_id IN (
             SELECT d.id FROM public.departments d WHERE d.responsible_person_id = auth.uid()
           )
      )
    )
  );

-- 3. Manager Insert Access:
-- Managers can evaluate their own direct reports or managed department members
DROP POLICY IF EXISTS "kpi_eval_manager_insert" ON public.kpi_evaluations;
CREATE POLICY "kpi_eval_manager_insert" ON public.kpi_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND (
      evaluator_id = auth.uid()
      OR employee_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.manager_id = auth.uid()
           OR p.department_id IN (
             SELECT d.id FROM public.departments d WHERE d.responsible_person_id = auth.uid()
           )
      )
    )
  );

-- 4. Manager Update Access:
-- Managers can update evaluations they created or for their team while not yet approved
DROP POLICY IF EXISTS "kpi_eval_manager_update" ON public.kpi_evaluations;
CREATE POLICY "kpi_eval_manager_update" ON public.kpi_evaluations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND (
      evaluator_id = auth.uid()
      OR employee_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.manager_id = auth.uid()
           OR p.department_id IN (
             SELECT d.id FROM public.departments d WHERE d.responsible_person_id = auth.uid()
           )
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND (
      evaluator_id = auth.uid()
      OR employee_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.manager_id = auth.uid()
           OR p.department_id IN (
             SELECT d.id FROM public.departments d WHERE d.responsible_person_id = auth.uid()
           )
      )
    )
  );

-- 5. Employee Self Read Access:
-- Employees can view their own evaluation once submitted, reviewed, or approved
DROP POLICY IF EXISTS "kpi_eval_employee_read" ON public.kpi_evaluations;
CREATE POLICY "kpi_eval_employee_read" ON public.kpi_evaluations
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid() 
    AND status IN ('submitted', 'reviewed', 'approved')
  );

