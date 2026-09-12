-- Per-employee allowed distance for an assigned work location.
-- When NULL the location's own radius_m is used.
ALTER TABLE public.geofence_assignments
  ADD COLUMN IF NOT EXISTS radius_m INTEGER;

-- Per-employee switch: is an approved device required to check in / out?
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_check_required BOOLEAN NOT NULL DEFAULT false;
