
-- Staff role can read/update attendance for any employee
CREATE POLICY "att staff read" ON public.attendance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "att staff update" ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "att staff insert" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "att staff delete" ON public.attendance
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

-- Staff role can read/update leaves for any employee
CREATE POLICY "leaves staff read" ON public.leaves
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "leaves staff update" ON public.leaves
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));
