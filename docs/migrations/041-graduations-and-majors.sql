-- Migration: 041-graduations-and-majors
-- Description: Create graduations and majors tables, add foreign keys to profiles, and seed default records

-- 1. Graduations table (المؤهلات الدراسية)
CREATE TABLE IF NOT EXISTS public.graduations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name_en text NOT NULL,
    name_ar text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT graduations_pkey PRIMARY KEY (id)
);

-- Enable RLS for graduations
ALTER TABLE public.graduations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users on graduations" ON public.graduations;
CREATE POLICY "Enable read access for authenticated users on graduations" ON public.graduations
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Enable all access for admin users on graduations" ON public.graduations;
CREATE POLICY "Enable all access for admin users on graduations" ON public.graduations
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Updated_at trigger for graduations
DROP TRIGGER IF EXISTS set_graduations_updated_at ON public.graduations;
CREATE TRIGGER set_graduations_updated_at
    BEFORE UPDATE ON public.graduations
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Majors table (التخصصات)
CREATE TABLE IF NOT EXISTS public.majors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name_en text NOT NULL,
    name_ar text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT majors_pkey PRIMARY KEY (id)
);

-- Enable RLS for majors
ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users on majors" ON public.majors;
CREATE POLICY "Enable read access for authenticated users on majors" ON public.majors
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Enable all access for admin users on majors" ON public.majors;
CREATE POLICY "Enable all access for admin users on majors" ON public.majors
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Updated_at trigger for majors
DROP TRIGGER IF EXISTS set_majors_updated_at ON public.majors;
CREATE TRIGGER set_majors_updated_at
    BEFORE UPDATE ON public.majors
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Add columns to profiles table
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS graduation_id uuid REFERENCES public.graduations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS major_id uuid REFERENCES public.majors(id) ON DELETE SET NULL;

-- 4. Seed initial default graduations
INSERT INTO public.graduations (name_en, name_ar)
SELECT 'High School Diploma', 'ثانوية عامة / ما يعادلها'
WHERE NOT EXISTS (SELECT 1 FROM public.graduations WHERE name_en = 'High School Diploma');

INSERT INTO public.graduations (name_en, name_ar)
SELECT 'Technical / Vocational Diploma', 'دبلوم فني / متوسط'
WHERE NOT EXISTS (SELECT 1 FROM public.graduations WHERE name_en = 'Technical / Vocational Diploma');

INSERT INTO public.graduations (name_en, name_ar)
SELECT 'Bachelor''s Degree', 'بكالوريوس / ليسانس'
WHERE NOT EXISTS (SELECT 1 FROM public.graduations WHERE name_en = 'Bachelor''s Degree');

INSERT INTO public.graduations (name_en, name_ar)
SELECT 'Postgraduate Diploma', 'دبلوم دراسات عليا'
WHERE NOT EXISTS (SELECT 1 FROM public.graduations WHERE name_en = 'Postgraduate Diploma');

INSERT INTO public.graduations (name_en, name_ar)
SELECT 'Master''s Degree', 'ماجستير'
WHERE NOT EXISTS (SELECT 1 FROM public.graduations WHERE name_en = 'Master''s Degree');

INSERT INTO public.graduations (name_en, name_ar)
SELECT 'Doctorate / PhD', 'دكتوراه'
WHERE NOT EXISTS (SELECT 1 FROM public.graduations WHERE name_en = 'Doctorate / PhD');

-- 5. Seed initial default majors
INSERT INTO public.majors (name_en, name_ar)
SELECT 'Computer Science & IT', 'علوم الحاسب ونظم المعلومات'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'Computer Science & IT');

INSERT INTO public.majors (name_en, name_ar)
SELECT 'Business Administration', 'إدارة الأعمال'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'Business Administration');

INSERT INTO public.majors (name_en, name_ar)
SELECT 'Accounting & Finance', 'المحاسبة والمالية'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'Accounting & Finance');

INSERT INTO public.majors (name_en, name_ar)
SELECT 'Human Resources Management', 'إدارة الموارد البشرية'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'Human Resources Management');

INSERT INTO public.majors (name_en, name_ar)
SELECT 'Engineering', 'الهندسة'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'Engineering');

INSERT INTO public.majors (name_en, name_ar)
SELECT 'Law & Legal Studies', 'الحقوق والشؤون القانونية'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'Law & Legal Studies');

INSERT INTO public.majors (name_en, name_ar)
SELECT 'Marketing & Communications', 'التسويق والإعلام'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'Marketing & Communications');

INSERT INTO public.majors (name_en, name_ar)
SELECT 'Commerce', 'تجارة'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'Commerce');

INSERT INTO public.majors (name_en, name_ar)
SELECT 'General / Other', 'عام / أخرى'
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name_en = 'General / Other');
