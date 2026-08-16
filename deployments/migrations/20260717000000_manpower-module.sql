-- ============================================================
-- Combined Migration: job_grades + department_positions + sections + manpower_plans + gender
-- ============================================================

-- 1. Job Grades table
CREATE TABLE IF NOT EXISTS public.job_grades (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name_en text NOT NULL,
    name_ar text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT job_grades_pkey PRIMARY KEY (id)
);

ALTER TABLE public.job_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.job_grades;
CREATE POLICY "Enable read access for authenticated users" ON public.job_grades
    AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable all access for admin users" ON public.job_grades;
CREATE POLICY "Enable all access for admin users" ON public.job_grades
    AS PERMISSIVE FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP TRIGGER IF EXISTS set_job_grades_updated_at ON public.job_grades;
CREATE TRIGGER set_job_grades_updated_at BEFORE UPDATE ON public.job_grades
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed G01-G15 grades
INSERT INTO public.job_grades (name_en, name_ar) VALUES
    ('G01 - Trainee', 'G01 - متدرب'),
    ('G02 - Junior Staff', 'G02 - موظف مبتدئ'),
    ('G03 - Officer', 'G03 - مسؤول'),
    ('G04 - Senior Officer', 'G04 - مسؤول أول'),
    ('G05 - Specialist', 'G05 - متخصص'),
    ('G06 - Senior Specialist', 'G06 - متخصص أول'),
    ('G07 - Team Leader', 'G07 - قائد فريق'),
    ('G08 - Supervisor', 'G08 - مشرف'),
    ('G09 - Assistant Manager', 'G09 - مساعد مدير'),
    ('G10 - Manager', 'G10 - مدير'),
    ('G11 - Senior Manager', 'G11 - مدير أول'),
    ('G12 - Department Head', 'G12 - رئيس قسم'),
    ('G13 - Director', 'G13 - مدير عام'),
    ('G14 - Executive Director', 'G14 - مدير تنفيذي'),
    ('G15 - CEO', 'G15 - رئيس تنفيذي')
ON CONFLICT DO NOTHING;

-- 2. Sections table
CREATE TABLE IF NOT EXISTS public.sections (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name_en text NOT NULL,
    name_ar text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sections_pkey PRIMARY KEY (id)
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.sections;
CREATE POLICY "Enable read access for authenticated users" ON public.sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.sections;
CREATE POLICY "Enable all access for admin users" ON public.sections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
DROP TRIGGER IF EXISTS set_sections_updated_at ON public.sections;
CREATE TRIGGER set_sections_updated_at BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Link Sections to Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL;

-- 4. Add gender to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female') OR gender IS NULL);

-- 5. Department Positions table
CREATE TABLE IF NOT EXISTS public.department_positions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    job_grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,
    section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
    headcount integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT department_positions_pkey PRIMARY KEY (id),
    CONSTRAINT department_positions_unique_dept_pos UNIQUE (department_id, position_id)
);

ALTER TABLE public.department_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.department_positions;
CREATE POLICY "Enable read access for authenticated users" ON public.department_positions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.department_positions;
CREATE POLICY "Enable all access for admin users" ON public.department_positions AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
DROP TRIGGER IF EXISTS set_department_positions_updated_at ON public.department_positions;
CREATE TRIGGER set_department_positions_updated_at BEFORE UPDATE ON public.department_positions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Manpower Plans table
CREATE TABLE IF NOT EXISTS public.manpower_plans (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    fiscal_year integer NOT NULL,
    company text,
    branch text,
    department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
    section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
    position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
    job_grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,

    planned_headcount integer NOT NULL DEFAULT 1,

    employment_type text CHECK (employment_type IN ('Full-Time', 'Part-Time', 'Contract', 'Temporary', 'Internship')),
    hiring_reason text,
    priority text CHECK (priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
    required_date date,

    salary_from numeric,
    salary_to numeric,
    currency text DEFAULT 'EGP',

    budget_available boolean DEFAULT false,
    budget_approved boolean DEFAULT false,
    cost_center text,
    estimated_annual_cost numeric,

    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Dept Manager', 'Pending HR', 'Pending Finance', 'Pending Executive', 'Approved', 'Rejected', 'Closed')),
    notes text,

    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT manpower_plans_pkey PRIMARY KEY (id)
);

ALTER TABLE public.manpower_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.manpower_plans;
CREATE POLICY "Enable read access for authenticated users" ON public.manpower_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for admin users" ON public.manpower_plans;
CREATE POLICY "Enable all access for admin users" ON public.manpower_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
DROP TRIGGER IF EXISTS set_manpower_plans_updated_at ON public.manpower_plans;
CREATE TRIGGER set_manpower_plans_updated_at BEFORE UPDATE ON public.manpower_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7. View: current headcount per position/department/section
CREATE OR REPLACE VIEW public.vw_current_headcount AS
SELECT
    department_id,
    section_id,
    position_id,
    COUNT(id) AS current_headcount
FROM public.profiles
WHERE status = 'ACTIVE'
  AND department_id IS NOT NULL
  AND position_id IS NOT NULL
GROUP BY department_id, section_id, position_id;
