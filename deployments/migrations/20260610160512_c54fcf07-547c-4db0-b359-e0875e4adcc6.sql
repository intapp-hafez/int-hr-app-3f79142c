ALTER TABLE public.leaves
  ADD COLUMN IF NOT EXISTS proof_url  text,
  ADD COLUMN IF NOT EXISTS proof_mime text,
  ADD COLUMN IF NOT EXISTS proof_name text;