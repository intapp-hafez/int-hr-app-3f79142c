-- Attendance rate limiting — complete setup (replaces 028 + 029, safe to re-run)
-- Run this in the Supabase SQL editor.

ALTER TABLE public.security_settings
  ADD COLUMN IF NOT EXISTS attendance_rate_limit_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS attendance_rate_limit_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS attendance_rate_limit_window_seconds integer NOT NULL DEFAULT 60;

CREATE TABLE IF NOT EXISTS public.attendance_check_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('check_in','check_out')),
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_check_attempts_user_time
  ON public.attendance_check_attempts (user_id, action, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.attendance_check_attempts TO authenticated;
GRANT ALL ON public.attendance_check_attempts TO service_role;

ALTER TABLE public.attendance_check_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can log their own check attempts" ON public.attendance_check_attempts;
CREATE POLICY "Users can log their own check attempts"
  ON public.attendance_check_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read their own check attempts" ON public.attendance_check_attempts;
CREATE POLICY "Users can read their own check attempts"
  ON public.attendance_check_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "Admins can clear check attempts" ON public.attendance_check_attempts;
CREATE POLICY "Admins can clear check attempts"
  ON public.attendance_check_attempts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
