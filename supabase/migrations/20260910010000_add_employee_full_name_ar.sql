-- Add full_name_ar to profiles table for Arabic employee names
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name_ar text;
