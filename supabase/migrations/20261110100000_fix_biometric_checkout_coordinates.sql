-- ============================================================================
-- Fix Biometric Checkout Coordinates (out_lat, out_lng)
-- Migration: 20261110100000_fix_biometric_checkout_coordinates.sql
-- Description: Ensures p_lat and p_lng passed during biometric check-out are 
--              correctly saved to attendance.out_lat and attendance.out_lng,
--              preventing the "No GPS" indicator on check-out records.
-- ============================================================================

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
    INSERT INTO public.attendance_idempotency_records (
      idempotency_key, user_id, action, request_hash, status, response_payload, created_at, updated_at
    ) VALUES (
      p_idempotency_key, p_user_id, p_action, p_request_hash, 'processing', '{}'::jsonb, v_server_now, v_server_now
    )
    ON CONFLICT (idempotency_key) DO UPDATE
      SET idempotency_key = attendance_idempotency_records.idempotency_key
    RETURNING * INTO v_existing_idempotency;

    IF v_existing_idempotency.user_id <> p_user_id 
       OR v_existing_idempotency.action <> p_action 
       OR v_existing_idempotency.request_hash IS DISTINCT FROM p_request_hash THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'IDEMPOTENCY_CONFLICT',
        'message', 'Idempotency key has already been used with different request parameters or user.'
      );
    END IF;

    IF v_existing_idempotency.status = 'completed' THEN
      RETURN v_existing_idempotency.response_payload;
    END IF;

    IF v_existing_idempotency.status = 'failed' THEN
      RETURN v_existing_idempotency.response_payload;
    END IF;

    IF v_existing_idempotency.status = 'processing' THEN
      IF v_existing_idempotency.created_at < (v_server_now - interval '30 seconds') THEN
        UPDATE public.attendance_idempotency_records
        SET updated_at = v_server_now
        WHERE idempotency_key = p_idempotency_key;
      ELSIF v_existing_idempotency.created_at <> v_server_now THEN
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

  IF p_accuracy IS NOT NULL AND (p_accuracy < 0.0 OR p_accuracy > 150.0) THEN
    v_error_res := jsonb_build_object('ok', false, 'code', 'LOW_ACCURACY_LOCATION', 'message', 'Location accuracy must be non-negative and <= 150m.');
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
      UPDATE public.attendance_idempotency_records SET status = 'failed', response_payload = v_error_res, updated_at = v_server_now WHERE idempotency_key = p_idempotency_key;
    END IF;
    RETURN v_error_res;
  END IF;

  IF p_location_time IS NULL 
     OR (v_server_now - p_location_time) > interval '120 seconds' 
     OR (p_location_time - v_server_now) > interval '60 seconds' THEN
    v_error_res := jsonb_build_object('ok', false, 'code', 'STALE_LOCATION', 'message', 'Location timestamp is stale or desynchronized (max age 120s).');
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

  -- 5. Server-Side Geofence Enforcement (Free check if no assigned geofences)
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
    v_inside_geofence := true;
    v_matched_branch := 'remote';
  ELSIF NOT v_inside_geofence THEN
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

    -- FIX: Store out_lat = p_lat and out_lng = p_lng alongside checkout timestamp and accuracy
    UPDATE public.attendance
    SET out_time = v_server_now,
        verified_face = true,
        out_lat = p_lat,
        out_lng = p_lng,
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
      'accuracy_m', p_accuracy,
      'lat', p_lat,
      'lng', p_lng
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
