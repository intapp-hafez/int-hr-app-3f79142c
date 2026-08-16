-- Phase 1 Profile Enhancements

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS extra_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS medical_insurance_details TEXT,
ADD COLUMN IF NOT EXISTS is_insured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS military_expire_date DATE,
ADD COLUMN IF NOT EXISTS is_five_percent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS social_insurance_date DATE,
ADD COLUMN IF NOT EXISTS custom_field TEXT,
ADD COLUMN IF NOT EXISTS last_action_date TIMESTAMP WITH TIME ZONE;
