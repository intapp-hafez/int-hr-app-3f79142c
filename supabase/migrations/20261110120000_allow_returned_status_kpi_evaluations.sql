-- ==============================================================================
-- Migration: Allow 'returned' status in kpi_evaluations table
-- Enables per-quarter and evaluation return workflows with return notes
-- ==============================================================================

ALTER TABLE public.kpi_evaluations 
  DROP CONSTRAINT IF EXISTS kpi_evaluations_status_check;

ALTER TABLE public.kpi_evaluations 
  ADD CONSTRAINT kpi_evaluations_status_check 
  CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved', 'returned'));
