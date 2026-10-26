-- Migration: Expand notification categories to include expirations and requests
-- Run this in Supabase SQL Editor if you previously created notification_category_prefs with a check constraint

ALTER TABLE public.notification_category_prefs
  DROP CONSTRAINT IF EXISTS notification_category_prefs_category_check;
