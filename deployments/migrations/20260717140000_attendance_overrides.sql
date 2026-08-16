-- Add a date column to allow working on leaves/holidays/weekends
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approved_work_date DATE;
