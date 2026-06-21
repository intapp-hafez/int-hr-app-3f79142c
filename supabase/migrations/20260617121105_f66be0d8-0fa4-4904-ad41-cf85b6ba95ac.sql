
-- 1) Face descriptors (one per user)
CREATE TABLE public.face_descriptors (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  descriptor jsonb NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.face_descriptors TO authenticated;
GRANT ALL ON public.face_descriptors TO service_role;
ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own face" ON public.face_descriptors
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin hr view face" ON public.face_descriptors
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE TRIGGER trg_face_descriptors_updated
  BEFORE UPDATE ON public.face_descriptors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) WebAuthn credentials (fingerprint / platform authenticators)
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_id text UNIQUE NOT NULL,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX idx_webauthn_creds_user ON public.webauthn_credentials(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own webauthn" ON public.webauthn_credentials
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin hr view webauthn" ON public.webauthn_credentials
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- 3) WebAuthn challenges (server-only)
CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text,
  challenge text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('register','authenticate')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webauthn_challenges_expiry ON public.webauthn_challenges(expires_at);
GRANT ALL ON public.webauthn_challenges TO service_role;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon: only service_role (server functions) may touch this.

-- 4) Attendance verification flags
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS verified_face boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_fp   boolean NOT NULL DEFAULT false;
