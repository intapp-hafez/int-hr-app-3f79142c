ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS external_income numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS external_tax_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS medical_insurance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_deductions numeric DEFAULT 0;
