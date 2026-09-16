-- Work Locations: per-employee radius + default location, and the
-- per-employee device requirement switch.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_check_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.geofence_assignments
  ADD COLUMN IF NOT EXISTS radius_m INTEGER,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS geofence_assignments_default_uniq
  ON public.geofence_assignments (profile_id)
  WHERE is_default;
