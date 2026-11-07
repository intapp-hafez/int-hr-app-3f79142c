-- ==============================================================================
-- Migration: Manager Project Visibility RLS Policies
-- Ensures each manager can ONLY see and access their related projects
-- ==============================================================================

-- 1. company_projects SELECT policy for managers
DROP POLICY IF EXISTS "company_projects_manager_read" ON public.company_projects;
CREATE POLICY "company_projects_manager_read" ON public.company_projects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND (
      project_manager_id = auth.uid()
      OR reported_manager_id = auth.uid()
      OR created_by = auth.uid()
      OR id IN (SELECT project_id FROM public.project_members WHERE employee_id = auth.uid())
      OR project_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
      OR reported_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 2. company_projects MODIFY policy for managers
DROP POLICY IF EXISTS "company_projects_manager_modify" ON public.company_projects;
CREATE POLICY "company_projects_manager_modify" ON public.company_projects
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND (
      project_manager_id = auth.uid()
      OR reported_manager_id = auth.uid()
      OR created_by = auth.uid()
      OR project_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
      OR reported_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager') AND (
      project_manager_id = auth.uid()
      OR reported_manager_id = auth.uid()
      OR created_by = auth.uid()
      OR project_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
      OR reported_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 3. project_tasks MODIFY policy for managers
DROP POLICY IF EXISTS "project_tasks_manager_all" ON public.project_tasks;
CREATE POLICY "project_tasks_manager_all" ON public.project_tasks FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND (
      project_id IN (
        SELECT id FROM public.company_projects
        WHERE project_manager_id = auth.uid()
           OR reported_manager_id = auth.uid()
           OR created_by = auth.uid()
           OR id IN (SELECT project_id FROM public.project_members WHERE employee_id = auth.uid())
           OR project_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
           OR reported_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager') AND (
      project_id IN (
        SELECT id FROM public.company_projects
        WHERE project_manager_id = auth.uid()
           OR reported_manager_id = auth.uid()
           OR created_by = auth.uid()
           OR id IN (SELECT project_id FROM public.project_members WHERE employee_id = auth.uid())
           OR project_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
           OR reported_manager_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

