-- ============================================================
-- Migration: Fake GPS Defense-in-Depth & Telemetry Hardening
-- Adds:
--   • Location snapshot columns to biometric_verification_tokens
--   • Allows nullable attendance_id on attendance_review_cases for blocked attempts
--   • Index on attendance_attempts for rapid restriction checks
-- ============================================================

-- 1. Location snapshot binding on biometric tokens
ALTER TABLE public.biometric_verification_tokens
  ADD COLUMN IF NOT EXISTS snapshot_lat double precision,
  ADD COLUMN IF NOT EXISTS snapshot_lng double precision,
  ADD COLUMN IF NOT EXISTS snapshot_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz;

-- 2. Allow review cases for blocked security attempts where no attendance row was inserted
ALTER TABLE public.attendance_review_cases
  ALTER COLUMN attendance_id DROP NOT NULL;

-- 3. Rapid index for recent spoofing / restriction lookups
CREATE INDEX IF NOT EXISTS idx_aa_restriction_lookup
  ON public.attendance_attempts(employee_id, decision, server_received_at DESC);

-- 4. Cascade deletion of attendance attempts when an attendance record is deleted
ALTER TABLE public.attendance_attempts
  DROP CONSTRAINT IF EXISTS attendance_attempts_attendance_id_fkey,
  ADD CONSTRAINT attendance_attempts_attendance_id_fkey
    FOREIGN KEY (attendance_id)
    REFERENCES public.attendance(id)
    ON DELETE CASCADE;
