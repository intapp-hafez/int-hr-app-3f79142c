-- Add district, street, and radius_m (default 500m) to trip_allowance_policies
ALTER TABLE public.trip_allowance_policies
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS radius_m integer NOT NULL DEFAULT 500;

-- Drop legacy unique constraint to allow multiple location policies per city (e.g., per district or street)
ALTER TABLE public.trip_allowance_policies 
DROP CONSTRAINT IF EXISTS trip_allowance_policies_city_id_job_grade_key;

-- Create composite unique index to prevent duplicate rates for the exact same location & job grade
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_allowance_policy_location_grade 
ON public.trip_allowance_policies (
    city_id, 
    coalesce(district, ''), 
    coalesce(street, ''), 
    coalesce(radius_m, 500),
    job_grade
);
