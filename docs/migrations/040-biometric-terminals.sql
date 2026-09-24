-- Biometric attendance devices (terminals) registered per work location.
CREATE TABLE IF NOT EXISTS public.biometric_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  device_code text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'face',
  location_id uuid REFERENCES public.geofence_locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  last_seen_at timestamptz,
  disabled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_terminals TO authenticated;
GRANT ALL ON public.biometric_terminals TO service_role;
ALTER TABLE public.biometric_terminals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin/HR manage terminals" ON public.biometric_terminals;
CREATE POLICY "Admin/HR manage terminals" ON public.biometric_terminals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
DROP TRIGGER IF EXISTS biometric_terminals_updated_at ON public.biometric_terminals;
CREATE TRIGGER biometric_terminals_updated_at BEFORE UPDATE ON public.biometric_terminals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
