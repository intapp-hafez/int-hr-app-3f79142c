-- Migration: Remove parent_id from sections table and make department_id optional
-- Standardized 18 levels (LEVEL 1..6 with grades A+, B+, C+)

ALTER TABLE public.sections ALTER COLUMN department_id DROP NOT NULL;
ALTER TABLE public.sections DROP COLUMN IF EXISTS parent_id;
