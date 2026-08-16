ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emp_code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_emp_code_unique ON public.profiles (emp_code) WHERE emp_code IS NOT NULL;