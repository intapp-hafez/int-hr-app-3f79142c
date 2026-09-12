-- Add medical_insurance_number and medical_insurance_type to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS medical_insurance_number text,
ADD COLUMN IF NOT EXISTS medical_insurance_type text;
