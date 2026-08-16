CREATE TABLE IF NOT EXISTS public.security_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  enforce_2fa boolean NOT NULL DEFAULT false,
  session_timeout_minutes integer NOT NULL DEFAULT 480,
  ip_allowlist text[] NOT NULL DEFAULT '{}',
  rate_limit_per_min integer NOT NULL DEFAULT 120,
  csp_enabled boolean NOT NULL DEFAULT true,
  hsts_enabled boolean NOT NULL DEFAULT true,
  x_frame_deny boolean NOT NULL DEFAULT true,
  referrer_policy text NOT NULL DEFAULT 'strict-origin-when-cross-origin',
  permissions_policy text NOT NULL DEFAULT 'camera=(), microphone=(), geolocation=(self)',
  block_sql_keywords boolean NOT NULL DEFAULT true,
  sanitize_html_inputs boolean NOT NULL DEFAULT true,
  cdn_subresource_integrity boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT security_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.security_settings TO authenticated;
GRANT ALL ON public.security_settings TO service_role;

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_settings_admin_select" ON public.security_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "security_settings_admin_insert" ON public.security_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "security_settings_admin_update" ON public.security_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.security_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER security_settings_set_updated_at
  BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();