
CREATE TABLE public.security_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'manual',
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  hit_count integer NOT NULL DEFAULT 0,
  manual boolean NOT NULL DEFAULT true,
  created_by uuid,
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_blocklist TO authenticated;
GRANT ALL ON public.security_blocklist TO service_role;
ALTER TABLE public.security_blocklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read blocklist" ON public.security_blocklist FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write blocklist" ON public.security_blocklist FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX security_blocklist_ip_idx ON public.security_blocklist(ip);

CREATE TABLE public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  path text,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_audit_events TO authenticated;
GRANT ALL ON public.security_audit_events TO service_role;
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit events" ON public.security_audit_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX security_audit_events_created_idx ON public.security_audit_events(created_at DESC);
CREATE INDEX security_audit_events_ip_idx ON public.security_audit_events(ip);
