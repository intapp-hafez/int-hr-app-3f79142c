-- Migration: 20261126143000_auto_checkout_midnight.sql
-- Description: Settings and idempotency lock table for "Auto checkout at midnight"

CREATE TABLE IF NOT EXISTS public.attendance_automation_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_checkout_at_midnight boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Africa/Cairo',
  last_run_date text,
  last_run_at timestamptz,
  last_run_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.attendance_automation_settings (id, auto_checkout_at_midnight, timezone)
VALUES (1, false, 'Africa/Cairo')
ON CONFLICT (id) DO NOTHING;

-- Idempotency lock table: prevents duplicate midnight checkout runs for the same local date
CREATE TABLE IF NOT EXISTS public.auto_checkout_runs (
  run_date text PRIMARY KEY,
  timezone text NOT NULL,
  checked_out_count integer NOT NULL DEFAULT 0,
  employee_ids uuid[] NOT NULL DEFAULT '{}',
  executed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_checkout_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.attendance_automation_settings TO authenticated;
GRANT SELECT ON public.auto_checkout_runs TO authenticated;

DROP POLICY IF EXISTS "auto_checkout_settings_select_admin" ON public.attendance_automation_settings;
CREATE POLICY "auto_checkout_settings_select_admin" ON public.attendance_automation_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "auto_checkout_settings_update_admin" ON public.attendance_automation_settings;
CREATE POLICY "auto_checkout_settings_update_admin" ON public.attendance_automation_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "auto_checkout_runs_select_admin" ON public.auto_checkout_runs;
CREATE POLICY "auto_checkout_runs_select_admin" ON public.auto_checkout_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
