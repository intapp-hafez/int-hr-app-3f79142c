-- Admin reset of per-employee attendance rate-limit counters
-- Run this in the Supabase SQL editor.

GRANT DELETE ON public.attendance_check_attempts TO authenticated;

DROP POLICY IF EXISTS "Admins can clear check attempts" ON public.attendance_check_attempts;
CREATE POLICY "Admins can clear check attempts"
  ON public.attendance_check_attempts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
