-- ============================================================
-- Anti-Spoofing Hardening Migration (Phase 1-2)
-- Adds:
--   • accuracy_m, gps_age_ms, gps_sample_count on attendance
--   • decision + reason_codes + policy_version on attendance
--   • attendance_review_cases — pending/review queue
--   • attendance_attempts — structured audit log per attempt
--   • biometric_verification_tokens — short-lived verification tokens
-- All changes are ADDITIVE, IDEMPOTENT, and REVERSIBLE.
-- ============================================================

-- 0. Biometric verification tokens table (if not already created)
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
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 1. GPS telemetry + decision columns on attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS accuracy_m        double precision,
  ADD COLUMN IF NOT EXISTS gps_age_ms        integer,
  ADD COLUMN IF NOT EXISTS gps_sample_count  integer,
  ADD COLUMN IF NOT EXISTS out_accuracy_m    double precision,
  ADD COLUMN IF NOT EXISTS out_gps_age_ms    integer,
  ADD COLUMN IF NOT EXISTS decision          text NOT NULL DEFAULT 'accept' CHECK (decision IN ('accept', 'review', 'reject')),
  ADD COLUMN IF NOT EXISTS reason_codes      jsonb,
  ADD COLUMN IF NOT EXISTS policy_version    integer NOT NULL DEFAULT 1;

-- 2. Review queue for uncertain/pending presence cases
CREATE TABLE IF NOT EXISTS public.attendance_review_cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id   uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  action          text NOT NULL CHECK (action IN ('check_in', 'check_out')),
  reason_codes    jsonb,
  risk_signals    jsonb,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id     uuid REFERENCES public.profiles(id),
  reviewer_note   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_arc_employee    ON public.attendance_review_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_arc_status      ON public.attendance_review_cases(status);
CREATE INDEX IF NOT EXISTS idx_arc_created     ON public.attendance_review_cases(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.attendance_review_cases TO authenticated;
GRANT ALL ON public.attendance_review_cases TO service_role;
ALTER TABLE public.attendance_review_cases ENABLE ROW LEVEL SECURITY;

-- Employees can read their own; admins/HR/managers can read
DROP POLICY IF EXISTS "arc own read" ON public.attendance_review_cases;
CREATE POLICY "arc own read" ON public.attendance_review_cases
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = attendance_review_cases.employee_id
        AND p.manager_id = auth.uid()
    )
  );

-- Admins/HR/Managers can update (review/approve/reject)
DROP POLICY IF EXISTS "arc admin write" ON public.attendance_review_cases;
CREATE POLICY "arc admin write" ON public.attendance_review_cases
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = attendance_review_cases.employee_id
        AND p.manager_id = auth.uid()
    )
  );

-- Employees insert their own review case during check-in/out in SPA mode
DROP POLICY IF EXISTS "arc own insert" ON public.attendance_review_cases;
DROP POLICY IF EXISTS "arc service insert" ON public.attendance_review_cases;
CREATE POLICY "arc own insert" ON public.attendance_review_cases
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- 3. Structured per-attempt audit log
CREATE TABLE IF NOT EXISTS public.attendance_attempts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action                   text NOT NULL CHECK (action IN ('check_in', 'check_out')),
  server_received_at       timestamptz NOT NULL DEFAULT now(),
  claimed_lat              double precision,
  claimed_lng              double precision,
  claimed_accuracy_m       double precision,
  claimed_gps_age_ms       integer,
  claimed_gps_samples      integer,
  device_id                text,
  ssid_claimed             text,
  biometric_method         text,
  fence_distance_m         integer,
  fence_allowed_m          integer,
  fence_result             text,     -- 'inside' | 'outside' | 'uncertain' | 'no_fence'
  travel_speed_kmh         double precision,
  risk_signals             jsonb,
  decision                 text NOT NULL CHECK (decision IN ('accept', 'review', 'reject')),
  reason_codes             jsonb,
  policy_version           integer NOT NULL DEFAULT 1,
  attendance_id            uuid REFERENCES public.attendance(id)
);
CREATE INDEX IF NOT EXISTS idx_aa_employee   ON public.attendance_attempts(employee_id, server_received_at DESC);
CREATE INDEX IF NOT EXISTS idx_aa_decision   ON public.attendance_attempts(decision);

GRANT SELECT, INSERT ON public.attendance_attempts TO authenticated;
GRANT ALL ON public.attendance_attempts TO service_role;
ALTER TABLE public.attendance_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aa own read" ON public.attendance_attempts;
CREATE POLICY "aa own read" ON public.attendance_attempts
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "aa own insert" ON public.attendance_attempts;
CREATE POLICY "aa own insert" ON public.attendance_attempts
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
