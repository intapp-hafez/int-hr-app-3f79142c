-- Migration: Short-lived, single-use biometric verification tokens
CREATE TABLE IF NOT EXISTS public.biometric_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  action text NOT NULL CHECK (action IN ('check_in', 'check_out', 'attendance')),
  method text NOT NULL CHECK (method IN ('face', 'fingerprint')),
  distance numeric,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bio_tokens_lookup ON public.biometric_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_bio_tokens_user ON public.biometric_verification_tokens(user_id, expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_verification_tokens TO authenticated;
GRANT ALL ON public.biometric_verification_tokens TO service_role;

ALTER TABLE public.biometric_verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own biometric tokens" ON public.biometric_verification_tokens;
CREATE POLICY "users manage own biometric tokens" ON public.biometric_verification_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
