-- Migration: 049-manager-assignment-history-rls
-- Description: Grant INSERT/UPDATE/DELETE and add RLS policies on manager_assignment_history for admins and HR

GRANT ALL ON public.manager_assignment_history TO authenticated;

DROP POLICY IF EXISTS "Admins and HR can insert manager history" ON public.manager_assignment_history;
CREATE POLICY "Admins and HR can insert manager history"
  ON public.manager_assignment_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "Admins and HR can update manager history" ON public.manager_assignment_history;
CREATE POLICY "Admins and HR can update manager history"
  ON public.manager_assignment_history FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "Admins and HR can delete manager history" ON public.manager_assignment_history;
CREATE POLICY "Admins and HR can delete manager history"
  ON public.manager_assignment_history FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
