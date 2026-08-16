ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS out_lat double precision,
  ADD COLUMN IF NOT EXISTS out_lng double precision,
  ADD COLUMN IF NOT EXISTS out_city text,
  ADD COLUMN IF NOT EXISTS out_district text,
  ADD COLUMN IF NOT EXISTS out_street text;