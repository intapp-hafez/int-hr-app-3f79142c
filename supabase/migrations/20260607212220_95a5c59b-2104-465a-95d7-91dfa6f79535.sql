ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_chk CHECK (status IN ('Active','Inactive'));