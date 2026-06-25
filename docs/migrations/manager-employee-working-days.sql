-- Allow a manager to view/edit working days for their direct reports.
-- Run once in the Supabase SQL editor.

DROP POLICY IF EXISTS "Managers manage reports working_days" ON public.employee_working_days;
CREATE POLICY "Managers manage reports working_days" ON public.employee_working_days FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = employee_working_days.employee_id
        AND p.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = employee_working_days.employee_id
        AND p.manager_id = auth.uid()
    )
  );