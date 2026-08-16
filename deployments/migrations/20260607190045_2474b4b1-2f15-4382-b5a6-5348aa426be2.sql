
DROP POLICY IF EXISTS "leaves update scope" ON public.leaves;
CREATE POLICY "leaves update scope" ON public.leaves FOR UPDATE TO authenticated USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
) WITH CHECK (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
);

DROP POLICY IF EXISTS "tasks update scope" ON public.tasks;
CREATE POLICY "tasks update scope" ON public.tasks FOR UPDATE TO authenticated USING (
  created_by = auth.uid()
  OR auth.uid() = ANY (assignees)
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
) WITH CHECK (
  created_by = auth.uid()
  OR auth.uid() = ANY (assignees)
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);

DROP POLICY IF EXISTS "trips update scope" ON public.trips;
CREATE POLICY "trips update scope" ON public.trips FOR UPDATE TO authenticated USING (
  assignee = auth.uid()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
) WITH CHECK (
  assignee = auth.uid()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
