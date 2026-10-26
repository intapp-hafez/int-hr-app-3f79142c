-- Allow managers to view profiles so they can manage their team and assign tasks/trips
DROP POLICY IF EXISTS "profiles manager read" ON public.profiles;

CREATE POLICY "profiles manager read" ON public.profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR manager_id = auth.uid()
    OR department_id IN (SELECT id FROM public.departments WHERE responsible_person_id = auth.uid())
  );
