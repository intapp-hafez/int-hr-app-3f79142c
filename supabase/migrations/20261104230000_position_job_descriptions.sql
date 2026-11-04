-- Migration: Create position_job_descriptions table
-- Stores structured, multi-section job descriptions linked to HR positions.
-- Modelled on the Integrated Technics JD template (10 sections).
-- RLS: HR/admin write, all authenticated read.

CREATE TABLE IF NOT EXISTS public.position_job_descriptions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id              uuid        NOT NULL UNIQUE REFERENCES public.positions(id) ON DELETE CASCADE,

  -- § 1  Job Identification metadata
  job_code                 text        NOT NULL DEFAULT '',
  job_category             text        NOT NULL DEFAULT 'Non-managerial', -- 'Managerial' | 'Non-managerial'
  position_type            text        NOT NULL DEFAULT 'Full-time',       -- 'Full-time' | 'Part-time' | 'Contract'
  location_type            text        NOT NULL DEFAULT 'On-site',         -- 'On-site' | 'Remote' | 'Hybrid'
  job_grade                text        NOT NULL DEFAULT '',

  -- § 2  Job Summary
  job_summary              text        NOT NULL DEFAULT '',

  -- § 3  Responsibilities / Duties  (ordered list)
  responsibilities         text[]      NOT NULL DEFAULT '{}',

  -- § 4  Qualifications & Competencies
  qualifications           text        NOT NULL DEFAULT '',
  technical_competencies   text[]      NOT NULL DEFAULT '{}',
  behavioral_competencies  text[]      NOT NULL DEFAULT '{}',

  -- § 6  Relationships
  internal_relations       text        NOT NULL DEFAULT '',
  external_relations       text        NOT NULL DEFAULT '',

  -- § 7  Authority
  authority                text[]      NOT NULL DEFAULT '{}',

  -- § 8  Career Path
  career_path              text[]      NOT NULL DEFAULT '{}',

  -- § 9  Document Control
  doc_version              text        NOT NULL DEFAULT 'v1.0',
  reviewed_by              text        NOT NULL DEFAULT '',
  approved_by              text        NOT NULL DEFAULT '',

  -- Legacy / tags (kept for search)
  tags                     text[]      NOT NULL DEFAULT '{}',

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_job_descriptions TO authenticated;
GRANT ALL ON public.position_job_descriptions TO service_role;

ALTER TABLE public.position_job_descriptions ENABLE ROW LEVEL SECURITY;

-- Allow employees to read job descriptions (for Job Description tab)
CREATE POLICY "Employees can read position descriptions"
  ON public.position_job_descriptions FOR SELECT TO authenticated
  USING (true);

-- Only HR and admins can manage (insert/update/delete)
CREATE POLICY "HR and admins manage position descriptions"
  ON public.position_job_descriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER position_job_descriptions_updated_at
  BEFORE UPDATE ON public.position_job_descriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

