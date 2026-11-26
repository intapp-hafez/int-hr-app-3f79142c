-- Migration: 20261126152500_employee_fingerprint_enabled.sql
-- Description: Per-employee toggle to enable/disable fingerprint verification during check-in/out

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fingerprint_enabled boolean NOT NULL DEFAULT true;
