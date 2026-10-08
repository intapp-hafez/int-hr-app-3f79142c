-- Trip allowances by POSITION and GEOFENCE work location
ALTER TABLE public.trip_allowance_policies
  ADD COLUMN IF NOT EXISTS geofence_location_id uuid REFERENCES public.geofence_locations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE;

ALTER TABLE public.trip_allowance_policies ALTER COLUMN city_id DROP NOT NULL;
ALTER TABLE public.trip_allowance_policies ALTER COLUMN job_grade DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trip_allowance_geofence_position_uniq
  ON public.trip_allowance_policies (geofence_location_id, position_id)
  WHERE geofence_location_id IS NOT NULL;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS geofence_location_id uuid REFERENCES public.geofence_locations(id) ON DELETE SET NULL;
