-- Migration: 042-employee-bank-details
-- Description: Add bank_name and bank_account_number columns to profiles table

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS bank_name text,
    ADD COLUMN IF NOT EXISTS bank_account_number text;
