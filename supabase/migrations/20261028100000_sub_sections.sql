-- Migration: sub_sections
-- Description: Create sub_sections table for department sections (e.g., HR -> sections a, b, c, d)

CREATE TABLE IF NOT EXISTS public.sub_sections (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name_en text NOT NULL,
    name_ar text NOT NULL DEFAULT '',
    code text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sub_sections_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sub_sections_department_id ON public.sub_sections(department_id);
CREATE INDEX IF NOT EXISTS idx_sub_sections_active ON public.sub_sections(active);

-- Enable RLS
ALTER TABLE public.sub_sections ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.sub_sections;
CREATE POLICY "Enable read access for authenticated users" ON public.sub_sections
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Enable all access for admin users" ON public.sub_sections;
CREATE POLICY "Enable all access for admin users" ON public.sub_sections
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_sub_sections_updated_at ON public.sub_sections;
CREATE TRIGGER set_sub_sections_updated_at
    BEFORE UPDATE ON public.sub_sections
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_updated_at();
