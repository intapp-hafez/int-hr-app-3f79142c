-- ==============================================================================
-- Migration: KPI Evaluation Periods & Audit Log
-- Enables HR Admin to control managers' quarterly KPI evaluation access windows,
-- automatic expiration, manual close/reopen, and immutable audit logging.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.kpi_evaluation_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluation_year integer NOT NULL CHECK (evaluation_year BETWEEN 2020 AND 2100),
  quarter text NOT NULL CHECK (quarter IN ('q1', 'q2', 'q3', 'q4')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_manually_closed boolean NOT NULL DEFAULT false,
  reopened_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_eval_periods_date_range_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_eval_periods_manager_year_q
  ON public.kpi_evaluation_periods (manager_id, evaluation_year, quarter);

CREATE INDEX IF NOT EXISTS idx_kpi_eval_periods_dates
  ON public.kpi_evaluation_periods (start_date, end_date);

CREATE TABLE IF NOT EXISTS public.kpi_evaluation_period_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid REFERENCES public.kpi_evaluation_periods(id) ON DELETE SET NULL,
  manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluation_year integer NOT NULL,
  quarter text NOT NULL CHECK (quarter IN ('q1', 'q2', 'q3', 'q4')),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'reopened', 'extended', 'manually_closed')),
  previous_start_date date,
  previous_end_date date,
  new_start_date date,
  new_end_date date,
  reason text,
  performed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpi_eval_period_logs_period
  ON public.kpi_evaluation_period_logs (period_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kpi_eval_period_logs_created
  ON public.kpi_evaluation_period_logs (created_at DESC);

-- Enable RLS
ALTER TABLE public.kpi_evaluation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_evaluation_period_logs ENABLE ROW LEVEL SECURITY;

-- Policies for kpi_evaluation_periods
DROP POLICY IF EXISTS "HR Admin full access to evaluation periods" ON public.kpi_evaluation_periods;
CREATE POLICY "HR Admin full access to evaluation periods"
  ON public.kpi_evaluation_periods
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "Managers can view their own evaluation periods" ON public.kpi_evaluation_periods;
CREATE POLICY "Managers can view their own evaluation periods"
  ON public.kpi_evaluation_periods
  FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid());

-- Policies for kpi_evaluation_period_logs
DROP POLICY IF EXISTS "HR Admin can view and insert evaluation period logs" ON public.kpi_evaluation_period_logs;
CREATE POLICY "HR Admin can view and insert evaluation period logs"
  ON public.kpi_evaluation_period_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'hr')
    )
  );
