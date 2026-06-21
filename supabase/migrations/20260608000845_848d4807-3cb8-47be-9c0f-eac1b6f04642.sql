ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS id_issue_date date,
  ADD COLUMN IF NOT EXISTS id_expiry_date date;