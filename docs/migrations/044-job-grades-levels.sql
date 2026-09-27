-- Migration: 044-job-grades-levels
-- Description: Add code column to job_grades and insert levels from excel

-- 1. Add code column
ALTER TABLE public.job_grades ADD COLUMN IF NOT EXISTS code text;

-- 2. Add unique constraint so we can safely upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'job_grades_code_key'
    ) THEN
        ALTER TABLE public.job_grades ADD CONSTRAINT job_grades_code_key UNIQUE (code);
    END IF;
END $$;

-- 3. Update existing grades with matching codes
UPDATE public.job_grades SET code = 'M' WHERE name_en = 'Manager' AND code IS NULL;
UPDATE public.job_grades SET code = 'SUP' WHERE name_en = 'Supervisor' AND code IS NULL;

-- 4. Insert or update the levels from the provided Excel sheet
INSERT INTO public.job_grades (code, name_en, name_ar) VALUES 
('C', 'Chief Officer', 'رئيس تنفيذي'),
('D', 'Director', 'مدير إدارة'),
('M', 'Manager', 'مدير'),
('UM', 'Unit Manager', 'مدير وحدة'),
('PM', 'Project Manager', 'مدير مشروع'),
('TL', 'Team Leader', 'قائد فريق'),
('SUP', 'Supervisor', 'مشرف'),
('SR', 'Senior', 'متقدم / أول'),
('JR', 'Junior', 'مبتدئ'),
('WR', 'Worker', 'عامل')
ON CONFLICT (code) DO UPDATE 
SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar;
