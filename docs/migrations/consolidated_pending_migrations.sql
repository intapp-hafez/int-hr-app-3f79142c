-- =====================================================================
-- CONSOLIDATED PENDING MIGRATIONS FOR SUPABASE SQL EDITOR
-- Run these statements in your Supabase Project Dashboard -> SQL Editor
-- =====================================================================

-- 1. Per-employee work location radius override
-- Allows setting a custom allowed check-in radius (in meters) for a specific employee.
-- When NULL, the location's own default radius_m is used.
ALTER TABLE public.geofence_assignments
  ADD COLUMN IF NOT EXISTS radius_m INTEGER;

COMMENT ON COLUMN public.geofence_assignments.radius_m IS 
  'Per-employee allowed radius in meters for this location. NULL falls back to geofence_locations.radius_m.';

-- 2. Per-employee approved device requirement gate
-- When TRUE, the employee can only check-in / check-out from an approved device.
-- When FALSE (default), device approval is not required to punch attendance.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_check_required BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.device_check_required IS 
  'Flag indicating whether this employee requires an approved device to check in and out.';
