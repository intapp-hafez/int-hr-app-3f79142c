
CREATE TABLE public.employee_devices (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Device',
  user_agent text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE INDEX employee_devices_user_id_idx ON public.employee_devices(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_devices TO authenticated;
GRANT ALL ON public.employee_devices TO service_role;

ALTER TABLE public.employee_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own devices"
  ON public.employee_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Users register own devices"
  ON public.employee_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins/HR manage devices"
  ON public.employee_devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Users or admins delete devices"
  ON public.employee_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER employee_devices_updated_at
  BEFORE UPDATE ON public.employee_devices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
