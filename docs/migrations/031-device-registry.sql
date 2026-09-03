-- 031 · Device Registration & Approval layer
-- Run this in the Supabase SQL editor. Idempotent.

ALTER TABLE public.employee_devices
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS device_key text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by uuid,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_checkin timestamptz,
  ADD COLUMN IF NOT EXISTS last_checkout timestamptz;

ALTER TABLE public.employee_devices DROP CONSTRAINT IF EXISTS employee_devices_status_check;
ALTER TABLE public.employee_devices
  ADD CONSTRAINT employee_devices_status_check
  CHECK (status IN ('pending','approved','rejected','blocked','revoked'));

CREATE INDEX IF NOT EXISTS employee_devices_status_idx ON public.employee_devices(status);
CREATE INDEX IF NOT EXISTS employee_devices_fingerprint_idx ON public.employee_devices(fingerprint);

CREATE TABLE IF NOT EXISTS public.device_approval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  user_id uuid,
  action text NOT NULL CHECK (action IN ('register','approve','reject','block','unblock','revoke','replace','denied')),
  from_status text,
  to_status text,
  actor_id uuid,
  reason text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.device_approval_logs TO authenticated;
GRANT ALL ON public.device_approval_logs TO service_role;

ALTER TABLE public.device_approval_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and HR read device logs" ON public.device_approval_logs;
CREATE POLICY "Admins and HR read device logs"
  ON public.device_approval_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'hr')
    OR user_id = auth.uid()
  );

CREATE INDEX IF NOT EXISTS device_approval_logs_device_idx ON public.device_approval_logs(device_id);
CREATE INDEX IF NOT EXISTS device_approval_logs_created_idx ON public.device_approval_logs(created_at DESC);
