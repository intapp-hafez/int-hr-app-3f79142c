-- ==============================================================================
-- Migration: Hardened Zero-Trust Face Attendance Pipeline & Authorization (v5)
-- Safe Upgrade Path: ALTER TABLE ADD COLUMN IF NOT EXISTS & Legacy Record Backfill
-- Timezone: Africa/Cairo
-- Status: Production-Ready Database Schema & Atomic RPC Pipeline
-- ==============================================================================

-- 1. Challenges table with attempt limit & single-use consumption constraint
CREATE TABLE IF NOT EXISTS public.biometric_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('check_in', 'check_out')),
  challenge_type text NOT NULL DEFAULT 'pose_sequence',
  expected_sequence jsonb NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  expires_at timestamptz NOT NULL,
  used_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.biometric_challenges 
  ADD COLUMN IF NOT EXISTS used_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_bio_challenges_lookup 
  ON public.biometric_challenges (id, user_id, device_id, action);

CREATE INDEX IF NOT EXISTS idx_bio_challenges_rate_limit
  ON public.biometric_challenges (user_id, created_at DESC);

ALTER TABLE public.biometric_challenges ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.biometric_challenges TO service_role;
REVOKE ALL ON public.biometric_challenges FROM anon, authenticated;

-- 2. Biometric Verification Proofs table
CREATE TABLE IF NOT EXISTS public.biometric_verification_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('check_in', 'check_out')),
  proof_hash text NOT NULL UNIQUE,
  challenge_id uuid NOT NULL REFERENCES public.biometric_challenges(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.biometric_verification_proofs 
  ADD COLUMN IF NOT EXISTS used_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_bio_proofs_lookup 
  ON public.biometric_verification_proofs (proof_hash, user_id, action, device_id);

ALTER TABLE public.biometric_verification_proofs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.biometric_verification_proofs TO service_role;
REVOKE ALL ON public.biometric_verification_proofs FROM anon, authenticated;

-- 3. Idempotency table with status lifecycle & legacy record upgrade
CREATE TABLE IF NOT EXISTS public.attendance_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('check_in', 'check_out')),
  request_hash text NOT NULL DEFAULT 'legacy_record_unhashed',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.attendance_idempotency_records 
  ADD COLUMN IF NOT EXISTS request_hash text DEFAULT 'legacy_record_unhashed',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

-- Backfill legacy records to prevent NULL comparison bypass
UPDATE public.attendance_idempotency_records 
SET request_hash = 'legacy_record_unhashed' 
WHERE request_hash IS NULL;

CREATE INDEX IF NOT EXISTS idx_att_idempotency_lookup 
  ON public.attendance_idempotency_records (idempotency_key, user_id);

ALTER TABLE public.attendance_idempotency_records ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.attendance_idempotency_records TO service_role;
REVOKE ALL ON public.attendance_idempotency_records FROM anon, authenticated;

-- 4. Employee Devices table upgrade for cryptographic public key binding
ALTER TABLE public.employee_devices
  ADD COLUMN IF NOT EXISTS public_key text DEFAULT NULL;

-- 5. Align biometric_audit_log schema with metadata column
ALTER TABLE public.biometric_audit_log 
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 6. Hardening RLS on face_descriptors (Self-management per user & Admin/HR view)
ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.face_descriptors TO authenticated;
GRANT ALL ON public.face_descriptors TO service_role;

DROP POLICY IF EXISTS "users manage own face" ON public.face_descriptors;
CREATE POLICY "users manage own face" ON public.face_descriptors
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin hr view face" ON public.face_descriptors;
CREATE POLICY "admin hr view face" ON public.face_descriptors
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

-- Prevent direct unverified attendance creation by employees (handled via commit_biometric_attendance)
DROP POLICY IF EXISTS "att self insert" ON public.attendance;
DROP POLICY IF EXISTS "att self update" ON public.attendance;

-- Staff and Admin management policies for manual overrides and review
DROP POLICY IF EXISTS "att staff insert" ON public.attendance;
CREATE POLICY "att staff insert" ON public.attendance FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
);

DROP POLICY IF EXISTS "att staff update" ON public.attendance;
CREATE POLICY "att staff update" ON public.attendance FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
);

DROP POLICY IF EXISTS "att staff delete" ON public.attendance;
CREATE POLICY "att staff delete" ON public.attendance FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
);

DROP POLICY IF EXISTS "att read scope" ON public.attendance;
CREATE POLICY "att read scope" ON public.attendance FOR SELECT TO authenticated USING (
  employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager')
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'biometric_verification_tokens') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.biometric_verification_tokens FROM authenticated, anon;
    DROP POLICY IF EXISTS "users manage own biometric tokens" ON public.biometric_verification_tokens;
    DROP POLICY IF EXISTS "users read own biometric tokens" ON public.biometric_verification_tokens;
    CREATE POLICY "users read own biometric tokens" ON public.biometric_verification_tokens
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 7. Atomic Function: Request Biometric Challenge with Atomic Rate-Limiting & Policy Enforcement
CREATE OR REPLACE FUNCTION public.request_biometric_challenge(
  p_user_id uuid,
  p_device_id text,
  p_action text,
  p_expected_sequence jsonb,
  p_expires_in_seconds integer DEFAULT 45
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_server_now timestamptz := clock_timestamp();
  v_ten_mins_ago timestamptz := v_server_now - interval '10 minutes';
  v_recent_count integer;
  v_profile RECORD;
  v_device RECORD;
  v_challenge RECORD;
  v_expires_at timestamptz;
BEGIN
  -- 1. Validate action
  IF p_action NOT IN ('check_in', 'check_out') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Must specify check_in or check_out.');
  END IF;

  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_DEVICE', 'message', 'device_id is required.');
  END IF;

  -- 2. Verify Account Status (Fail-Closed)
  SELECT id, status, COALESCE(device_check_required, false) AS device_check_required
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_profile.id IS NULL OR v_profile.status <> 'Active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Authentication failed or account status is not Active.');
  END IF;

  -- 3. Atomic Rate-Limiting (Fail-Closed, Max 5 challenges per 10 minutes)
  SELECT count(*)
  INTO v_recent_count
  FROM public.biometric_challenges
  WHERE user_id = p_user_id
    AND created_at >= v_ten_mins_ago;

  IF v_recent_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED', 'message', 'Too many verification requests. Maximum 5 attempts per 10 minutes.');
  END IF;

  -- 4. Device Policy Check
  IF v_profile.device_check_required THEN
    SELECT status, public_key INTO v_device
    FROM public.employee_devices
    WHERE id = p_device_id AND user_id = p_user_id;

    IF v_device.status IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'DEVICE_NOT_REGISTERED', 'message', 'This device is not registered for your account.');
    ELSIF v_device.status <> 'approved' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'DEVICE_NOT_APPROVED', 'message', 'This device is not approved for attendance on your account.');
    END IF;
  END IF;

  -- 5. Insert Challenge atomically
  v_expires_at := v_server_now + (GREATEST(15, LEAST(120, p_expires_in_seconds)) || ' seconds')::interval;

  INSERT INTO public.biometric_challenges (
    user_id, device_id, action, challenge_type, expected_sequence, max_attempts, expires_at, created_at
  ) VALUES (
    p_user_id, p_device_id, p_action, 'pose_sequence', p_expected_sequence, 3, v_expires_at, v_server_now
  )
  RETURNING id, action, challenge_type, expected_sequence, expires_at
  INTO v_challenge;

  RETURN jsonb_build_object(
    'ok', true,
    'challenge_id', v_challenge.id,
    'challenge_action', v_challenge.action,
    'challenge_type', v_challenge.challenge_type,
    'expected_sequence', v_challenge.expected_sequence,
    'expires_at', v_challenge.expires_at
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.request_biometric_challenge FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_biometric_challenge TO service_role;

-- 8. Atomic Function: Record Challenge Failure (Never resets used_at to null)
CREATE OR REPLACE FUNCTION public.record_challenge_failure(
  p_challenge_id uuid,
  p_user_id uuid,
  p_device_id text,
  p_reason text,
  p_code text DEFAULT 'VERIFICATION_FAILED'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_chal public.biometric_challenges%ROWTYPE;
  v_next_attempts integer;
  v_should_burn boolean;
BEGIN
  -- Lock the challenge row atomically
  SELECT * INTO v_chal
  FROM public.biometric_challenges
  WHERE id = p_challenge_id
    AND user_id = p_user_id
    AND device_id = p_device_id
  FOR UPDATE;

  IF v_chal.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CHALLENGE_NOT_FOUND', 'message', 'Challenge not found or parameters mismatched.');
  END IF;

  -- If already consumed/burned, do not touch used_at!
  IF v_chal.used_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'code', 'CHALLENGE_ALREADY_CONSUMED', 
      'message', 'Challenge was already consumed or revoked. Failure recorded in audit.'
    );
  END IF;

  v_next_attempts := v_chal.attempt_count + 1;
  v_should_burn := (v_next_attempts >= v_chal.max_attempts);

  -- Update attempt count atomically. If burned, set used_at. If not, KEEP existing used_at.
  UPDATE public.biometric_challenges
  SET attempt_count = v_next_attempts,
      used_at = CASE WHEN v_should_burn THEN v_now ELSE used_at END
  WHERE id = v_chal.id AND used_at IS NULL;

  -- Audit log entry
  INSERT INTO public.biometric_audit_log (
    user_id, device_id, method, event, success, reason, metadata
  ) VALUES (
    p_user_id, p_device_id, 'face', v_chal.action, false, p_reason,
    jsonb_build_object(
      'code', p_code,
      'challenge_id', p_challenge_id,
      'attempt_count', v_next_attempts,
      'burned', v_should_burn
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', p_code,
    'burned', v_should_burn,
    'attempt_count', v_next_attempts,
    'max_attempts', v_chal.max_attempts
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.record_challenge_failure FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_challenge_failure TO service_role;

-- 9. Atomic Function: Consume Challenge & Mint Proof in ONE atomic transaction
CREATE OR REPLACE FUNCTION public.mint_biometric_proof(
  p_user_id uuid,
  p_device_id text,
  p_challenge_id uuid,
  p_proof_hash text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_challenge public.biometric_challenges%ROWTYPE;
BEGIN
  -- Lock & validate challenge atomically
  SELECT * INTO v_challenge
  FROM public.biometric_challenges
  WHERE id = p_challenge_id
    AND user_id = p_user_id
    AND device_id = p_device_id
    AND used_at IS NULL
    AND expires_at > v_now
  FOR UPDATE;

  IF v_challenge.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CHALLENGE_INVALID_OR_CONSUMED',
      'message', 'Challenge is invalid, expired, device mismatched, or already consumed.'
    );
  END IF;

  -- 1. Consume challenge
  UPDATE public.biometric_challenges
  SET used_at = v_now
  WHERE id = v_challenge.id;

  -- 2. Mint proof
  INSERT INTO public.biometric_verification_proofs (
    user_id, device_id, action, proof_hash, challenge_id, expires_at
  ) VALUES (
    p_user_id, p_device_id, v_challenge.action, p_proof_hash, v_challenge.id, p_expires_at
  );

  RETURN jsonb_build_object(
    'ok', true,
    'action', v_challenge.action,
    'consumed_at', v_now
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.mint_biometric_proof FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mint_biometric_proof TO service_role;

-- 10. Atomic Function: Complete Attendance Lifecycle & Hardened Idempotency
CREATE OR REPLACE FUNCTION public.commit_biometric_attendance(
  p_user_id uuid,
  p_device_id text,
  p_action text,
  p_proof_hash text,
  p_idempotency_key text,
  p_request_hash text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision,
  p_location_time timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_server_now timestamptz := clock_timestamp();
  v_today date := (v_server_now AT TIME ZONE 'Africa/Cairo')::date;
  v_proof_id uuid;
  v_existing_idempotency public.attendance_idempotency_records%ROWTYPE;
  v_existing_id uuid;
  v_in_time timestamptz;
  v_att_id uuid;
  v_result jsonb;
  v_error_res jsonb;
  v_device_check_required boolean := false;
  v_device_status text;
  v_matched_branch text := NULL;
  v_geofence_count integer := 0;
  v_inside_geofence boolean := false;
  v_geo RECORD;
  v_dist_meters double precision;
BEGIN
  -- 1. Concurrency-Safe Pre-Reservation of Idempotency Key
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    -- Try to insert 'processing' placeholder
    INSERT INTO public.attendance_idempotency_records (
      idempotency_key, user_id, action, request_hash, status, response_payload, created_at, updated_at
    ) VALUES (
      p_idempotency_key, p_user_id, p_action, p_request_hash, 'processing', '{}'::jsonb, v_server_now, v_server_now
    )
    ON CONFLICT (idempotency_key) DO UPDATE
      SET idempotency_key = attendance_idempotency_records.idempotency_key -- Row lock trigger
    RETURNING * INTO v_existing_idempotency;

    -- Strict verification across ALL statuses: key must belong to same user, action, and request_hash
    IF v_existing_idempotency.user_id <> p_user_id 
       OR v_existing_idempotency.action <> p_action 
       OR v_existing_idempotency.request_hash IS DISTINCT FROM p_request_hash THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'IDEMPOTENCY_CONFLICT',
        'message', 'Idempotency key has already been used with different request parameters or user.'
      );
    END IF;

    -- If completed: return cached payload immediately
    IF v_existing_idempotency.status = 'completed' THEN
      RETURN v_existing_idempotency.response_payload;
    END IF;

    -- If failed: return cached error payload
    IF v_existing_idempotency.status = 'failed' THEN
      RETURN v_existing_idempotency.response_payload;
    END IF;

    -- If processing: check age for stale recovery
    IF v_existing_idempotency.status = 'processing' THEN
      IF v_existing_idempotency.created_at < (v_server_now - interval '30 seconds') THEN
        -- Stale processing lock: allow recovery with same parameters
        UPDATE public.attendance_idempotency_records
        SET updated_at = v_server_now
        WHERE idempotency_key = p_idempotency_key;
      ELSIF v_existing_idempotency.created_at <> v_server_now THEN
        -- Concurrent attempt in flight
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'CONCURRENT_REQUEST_IN_PROGRESS',
          'message', 'A concurrent request with this idempotency key is actively processing.'
        );
      END IF;
    END IF;
  END IF;

  -- 2. Reject generic actions
  IF p_action NOT IN ('check_in', 'check_out') THEN
    v_error_res := jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'Action must be check_in or check_out.');
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
      UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
    END IF;
    RETURN v_error_res;
  END IF;

  -- 3. Strict GPS Coordinates Bounds and Accuracy Validation
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat < -90.0 OR p_lat > 90.0 OR p_lng < -180.0 OR p_lng > 180.0 THEN
    v_error_res := jsonb_build_object('ok', false, 'code', 'INVALID_COORDINATES', 'message', 'GPS coordinates are missing or out of physical bounds (-90..90, -180..180).');
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
      UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
    END IF;
    RETURN v_error_res;
  END IF;

  IF p_accuracy IS NULL OR p_accuracy < 0.0 OR p_accuracy > 50.0 THEN
    v_error_res := jsonb_build_object('ok', false, 'code', 'LOW_ACCURACY_LOCATION', 'message', 'Location accuracy must be non-negative and <= 50m.');
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
      UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
    END IF;
    RETURN v_error_res;
  END IF;

  IF p_location_time IS NULL 
     OR (v_server_now - p_location_time) > interval '30 seconds' 
     OR (p_location_time - v_server_now) > interval '10 seconds' THEN
    v_error_res := jsonb_build_object('ok', false, 'code', 'STALE_LOCATION', 'message', 'Location timestamp is stale or desynchronized (max age 30s).');
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
      UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
    END IF;
    RETURN v_error_res;
  END IF;

  -- 4. Server-Side Device Policy Enforcement
  SELECT COALESCE(device_check_required, false) INTO v_device_check_required
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_device_check_required THEN
    IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
      v_error_res := jsonb_build_object('ok', false, 'code', 'DEVICE_ID_REQUIRED', 'message', 'Device identifier is required.');
      IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
      END IF;
      RETURN v_error_res;
    END IF;

    SELECT status INTO v_device_status
    FROM public.employee_devices
    WHERE id = p_device_id AND user_id = p_user_id;

    IF v_device_status IS NULL THEN
      v_error_res := jsonb_build_object('ok', false, 'code', 'DEVICE_NOT_REGISTERED', 'message', 'This device is not registered for your account.');
      IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
      END IF;
      RETURN v_error_res;
    ELSIF v_device_status <> 'approved' THEN
      v_error_res := jsonb_build_object('ok', false, 'code', 'DEVICE_NOT_APPROVED', 'message', 'Device approval status is: ' || v_device_status);
      IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
      END IF;
      RETURN v_error_res;
    END IF;
  END IF;

  -- 5. Server-Side Geofence Enforcement (Strict Policy: Workplace Geofence Required)
  FOR v_geo IN
    SELECT gl.name, gl.lat, gl.lng, gl.radius_m
    FROM public.geofence_assignments ga
    JOIN public.geofence_locations gl ON gl.id = ga.location_id
    WHERE ga.profile_id = p_user_id AND gl.active = true
  LOOP
    v_geofence_count := v_geofence_count + 1;
    v_dist_meters := 2.0 * 6371000.0 * asin(sqrt(
      sin(radians(p_lat - v_geo.lat) / 2.0)^2 +
      cos(radians(v_geo.lat)) * cos(radians(p_lat)) * sin(radians(p_lng - v_geo.lng) / 2.0)^2
    ));

    IF v_dist_meters <= v_geo.radius_m THEN
      v_inside_geofence := true;
      v_matched_branch := v_geo.name;
      EXIT;
    END IF;
  END LOOP;

  IF v_geofence_count = 0 THEN
    v_error_res := jsonb_build_object(
      'ok', false,
      'code', 'NO_ASSIGNED_GEOFENCE',
      'message', 'No active workplace geofence configured for this employee. Contact HR/Admin.'
    );
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
      UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
    END IF;
    RETURN v_error_res;
  END IF;

  IF NOT v_inside_geofence THEN
    v_error_res := jsonb_build_object(
      'ok', false, 
      'code', 'GEOFENCE_VIOLATION', 
      'message', 'Current GPS location is outside all assigned workplace geofences.'
    );
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
      UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
    END IF;
    RETURN v_error_res;
  END IF;

  -- 6. Atomically Lock & Validate Biometric Proof (FOR UPDATE row-lock)
  SELECT id INTO v_proof_id
  FROM public.biometric_verification_proofs
  WHERE proof_hash = p_proof_hash
    AND user_id = p_user_id
    AND action = p_action
    AND device_id = p_device_id
    AND used_at IS NULL
    AND expires_at > v_server_now
  FOR UPDATE;

  IF v_proof_id IS NULL THEN
    v_error_res := jsonb_build_object(
      'ok', false,
      'code', 'INVALID_OR_CONSUMED_PROOF',
      'message', 'Biometric proof is invalid, expired (>2m), action/device mismatched, or already consumed.'
    );
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
      UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
    END IF;
    RETURN v_error_res;
  END IF;

  -- 7. Mark proof as consumed within this transaction
  UPDATE public.biometric_verification_proofs
  SET used_at = v_server_now
  WHERE id = v_proof_id;

  -- 8. Independent Check-In vs Check-Out Processing
  IF p_action = 'check_in' THEN
    SELECT id INTO v_existing_id
    FROM public.attendance
    WHERE employee_id = p_user_id AND date = v_today;

    IF v_existing_id IS NOT NULL THEN
      v_error_res := jsonb_build_object('ok', false, 'code', 'ALREADY_CHECKED_IN_TODAY', 'message', 'Employee already has a check-in record for today.');
      IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
      END IF;
      RETURN v_error_res;
    END IF;

    INSERT INTO public.attendance (
      employee_id, date, in_time, verified_face, status, 
      lat, lng, accuracy_m, device_id, branch
    ) VALUES (
      p_user_id, v_today, v_server_now, true, 'present',
      p_lat, p_lng, p_accuracy, p_device_id, v_matched_branch
    ) RETURNING id INTO v_att_id;

  ELSIF p_action = 'check_out' THEN
    SELECT id, in_time INTO v_existing_id, v_in_time
    FROM public.attendance
    WHERE employee_id = p_user_id
      AND out_time IS NULL
      AND (date = v_today OR date = v_today - interval '1 day')
    ORDER BY in_time DESC
    LIMIT 1
    FOR UPDATE;

    IF v_existing_id IS NULL THEN
      v_error_res := jsonb_build_object('ok', false, 'code', 'NO_OPEN_CHECKIN_FOUND', 'message', 'No open check-in session found to complete check-out.');
      IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
      END IF;
      RETURN v_error_res;
    END IF;

    UPDATE public.attendance
    SET out_time = v_server_now,
        verified_face = true,
        out_accuracy_m = p_accuracy,
        updated_at = v_server_now
    WHERE id = v_existing_id
    RETURNING id INTO v_att_id;
  END IF;

  -- 9. Audit Logging
  INSERT INTO public.biometric_audit_log (
    user_id, device_id, method, event, success, metadata
  ) VALUES (
    p_user_id, p_device_id, 'face', p_action, true,
    jsonb_build_object(
      'attendance_id', v_att_id, 
      'branch', v_matched_branch,
      'proof_id', v_proof_id,
      'accuracy_m', p_accuracy
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'attendance_id', v_att_id,
    'action', p_action,
    'branch', v_matched_branch,
    'server_timestamp', v_server_now,
    'work_date', v_today
  );

  -- 10. Complete idempotency record with atomic status = 'completed'
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    UPDATE public.attendance_idempotency_records
    SET status = 'completed', response_payload = v_result, updated_at = v_server_now
    WHERE idempotency_key = p_idempotency_key;
  END IF;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.commit_biometric_attendance FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_biometric_attendance TO service_role;
