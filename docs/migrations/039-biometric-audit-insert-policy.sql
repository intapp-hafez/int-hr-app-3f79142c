-- 039-biometric-audit-insert-policy.sql
-- Grant insert permissions and configure RLS policies for public.biometric_audit_log

GRANT SELECT, INSERT ON public.biometric_audit_log TO authenticated;
GRANT INSERT ON public.biometric_audit_log TO anon;
GRANT ALL ON public.biometric_audit_log TO service_role;

DROP POLICY IF EXISTS "allow authenticated insert biometric audit" ON public.biometric_audit_log;
CREATE POLICY "allow authenticated insert biometric audit" ON public.biometric_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow anon insert biometric audit for login" ON public.biometric_audit_log;
CREATE POLICY "allow anon insert biometric audit for login" ON public.biometric_audit_log
  FOR INSERT TO anon
  WITH CHECK (event = 'login');
