
CREATE TABLE public.network_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(network_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_assignments TO authenticated;
GRANT ALL ON public.network_assignments TO service_role;
ALTER TABLE public.network_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HR manage network assignments"
  ON public.network_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Users can view their own network assignments"
  ON public.network_assignments FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE INDEX idx_network_assignments_profile ON public.network_assignments(profile_id);
CREATE INDEX idx_network_assignments_network ON public.network_assignments(network_id);
