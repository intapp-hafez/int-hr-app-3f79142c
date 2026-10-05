-- Migration: 047-sections-sublevels
-- Description: Add parent_id to sections table to support sub-levels / hierarchical sections

ALTER TABLE public.sections 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sections_parent_id ON public.sections(parent_id);
