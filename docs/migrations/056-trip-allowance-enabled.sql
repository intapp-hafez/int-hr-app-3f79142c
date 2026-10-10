-- Per-employee switch: does this employee receive trip allowance? On by default.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trip_allowance_enabled boolean NOT NULL DEFAULT true;
