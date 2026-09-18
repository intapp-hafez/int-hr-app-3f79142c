-- Biometric audit log: face / fingerprint enrollment, verification, login and check-in events
CREATE TABLE IF NOT EXISTS public.biometric_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text,
  method text NOT NULL CHECK (method IN ('face','fingerprint')),
  event text NOT NULL CHECK (event IN ('enroll','unenroll','verify','login','check_in','check_out')),
  success boolean NOT NULL DEFAULT false,
  reason text,
  distance numeric,
  device_label text,
  device_id text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bio_audit_user ON public.biometric_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_bio_audit_created ON public.biometric_audit_log(created_at DESC);

GRANT SELECT, INSERT ON public.biometric_audit_log TO authenticated;
GRANT INSERT ON public.biometric_audit_log TO anon;
GRANT ALL ON public.biometric_audit_log TO service_role;

ALTER TABLE public.biometric_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own biometric audit" ON public.biometric_audit_log;
CREATE POLICY "users read own biometric audit" ON public.biometric_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin hr read biometric audit" ON public.biometric_audit_log;
CREATE POLICY "admin hr read biometric audit" ON public.biometric_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "allow authenticated insert biometric audit" ON public.biometric_audit_log;
CREATE POLICY "allow authenticated insert biometric audit" ON public.biometric_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow anon insert biometric audit for login" ON public.biometric_audit_log;
CREATE POLICY "allow anon insert biometric audit for login" ON public.biometric_audit_log
  FOR INSERT TO anon
  WITH CHECK (event = 'login');

