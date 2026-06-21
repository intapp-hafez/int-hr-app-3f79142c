ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salary_mode TEXT CHECK (salary_mode IN ('gross','net')),
  ADD COLUMN IF NOT EXISTS salary_gross NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS salary_net NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS allowance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_duration TEXT CHECK (target_duration IN ('Daily','Weekly','Monthly','Quarterly','Yearly')),
  ADD COLUMN IF NOT EXISTS contract_type TEXT CHECK (contract_type IN ('FullTime','PartTime','Temporary','Internship','Probation3M'));