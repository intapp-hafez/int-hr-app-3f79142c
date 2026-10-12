-- Includes 056 (safe to re-run) + monthly trip allowance table feeding payroll.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trip_allowance_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.monthly_trip_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  days int NOT NULL DEFAULT 0,
  checkin_amount numeric NOT NULL DEFAULT 0,
  trips_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  computed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_trip_allowances TO authenticated;
GRANT ALL ON public.monthly_trip_allowances TO service_role;
ALTER TABLE public.monthly_trip_allowances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mta staff manage" ON public.monthly_trip_allowances;
CREATE POLICY "mta staff manage" ON public.monthly_trip_allowances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'finance'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'finance'));
DROP POLICY IF EXISTS "mta own read" ON public.monthly_trip_allowances;
CREATE POLICY "mta own read" ON public.monthly_trip_allowances FOR SELECT TO authenticated USING (employee_id = auth.uid());
DROP TRIGGER IF EXISTS mta_updated_at ON public.monthly_trip_allowances;
CREATE TRIGGER mta_updated_at BEFORE UPDATE ON public.monthly_trip_allowances
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
