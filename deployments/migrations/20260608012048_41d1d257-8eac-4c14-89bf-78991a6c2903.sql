
-- Geofence locations
CREATE TABLE public.geofence_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_locations TO authenticated;
GRANT ALL ON public.geofence_locations TO service_role;
ALTER TABLE public.geofence_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR manage geofences" ON public.geofence_locations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Authenticated can view active geofences" ON public.geofence_locations
  FOR SELECT TO authenticated USING (active = true);
CREATE TRIGGER geofence_locations_set_updated_at
  BEFORE UPDATE ON public.geofence_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Geofence assignments (many-to-many)
CREATE TABLE public.geofence_assignments (
  location_id uuid NOT NULL REFERENCES public.geofence_locations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (location_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_assignments TO authenticated;
GRANT ALL ON public.geofence_assignments TO service_role;
ALTER TABLE public.geofence_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR manage geofence assignments" ON public.geofence_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Users can view their assignments" ON public.geofence_assignments
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- Contract audit log
CREATE TABLE public.contract_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  reason text,
  previous_end_date date,
  new_end_date date,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.contract_audit_log TO authenticated;
GRANT ALL ON public.contract_audit_log TO service_role;
ALTER TABLE public.contract_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/HR view contract audit" ON public.contract_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE POLICY "Admins/HR insert contract audit" ON public.contract_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE INDEX contract_audit_log_profile_idx ON public.contract_audit_log(profile_id, created_at DESC);
