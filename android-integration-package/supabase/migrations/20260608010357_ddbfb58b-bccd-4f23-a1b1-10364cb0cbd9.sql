ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_cancelled BOOLEAN NOT NULL DEFAULT FALSE;