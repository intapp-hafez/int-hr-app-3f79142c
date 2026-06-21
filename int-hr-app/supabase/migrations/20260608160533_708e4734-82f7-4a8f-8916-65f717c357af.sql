
-- Permissions system: role defaults + per-user overrides

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  page text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, page)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_perms_read_all_auth"
  ON public.role_permissions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "role_perms_admin_write"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_role_perms_updated_at BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page text NOT NULL,
  can_view boolean,
  can_create boolean,
  can_edit boolean,
  can_delete boolean,
  can_export boolean,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page)
);

GRANT SELECT ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_perm_read_self_or_admin"
  ON public.user_permission_overrides FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
  );

CREATE POLICY "user_perm_admin_write"
  ON public.user_permission_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_user_perm_updated_at BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- Effective permission resolver
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _page text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override boolean;
  v_role_val boolean;
  v_role public.app_role;
  v_col text;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _action NOT IN ('view','create','edit','delete','export') THEN RETURN false; END IF;

  -- admin: full access
  IF public.has_role(_user_id, 'admin') THEN RETURN true; END IF;

  v_col := 'can_' || _action;

  -- Check user override first
  EXECUTE format(
    'SELECT %I FROM public.user_permission_overrides WHERE user_id = $1 AND page = $2',
    v_col
  ) INTO v_override USING _user_id, _page;
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;

  -- Pick highest-privilege admin role for this user: hr > manager > user
  SELECT role INTO v_role FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('hr','manager','user')
    ORDER BY CASE role WHEN 'hr' THEN 1 WHEN 'manager' THEN 2 WHEN 'user' THEN 3 END
    LIMIT 1;
  IF v_role IS NULL THEN RETURN false; END IF;

  EXECUTE format(
    'SELECT %I FROM public.role_permissions WHERE role = $1 AND page = $2',
    v_col
  ) INTO v_role_val USING v_role, _page;

  RETURN COALESCE(v_role_val, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, anon;


-- Seed default role permissions
WITH pages(slug) AS (VALUES
  ('employees'),('attendance'),('leaves'),('leaves-requests'),('payroll'),
  ('holidays'),('holiday-types'),('contracts'),('kpis'),('allowances'),
  ('late-penalties'),('targets-overtime'),('shifts'),('networks'),('geofencing'),
  ('directory'),('employee-access'),('audit'),('reports'),('settings'),('roles')
)
INSERT INTO public.role_permissions (role, page, can_view, can_create, can_edit, can_delete, can_export)
SELECT 'hr'::public.app_role, slug,
  true,
  slug IN ('employees','leaves','leaves-requests','payroll','holidays','holiday-types','contracts','kpis','allowances','late-penalties','targets-overtime','shifts','attendance'),
  slug IN ('employees','leaves','leaves-requests','payroll','holidays','holiday-types','contracts','kpis','allowances','late-penalties','targets-overtime','shifts','attendance','directory'),
  slug IN ('employees','leaves','holidays','holiday-types','contracts','kpis','allowances','late-penalties','targets-overtime','shifts'),
  slug IN ('employees','attendance','leaves','payroll','contracts','reports','directory')
FROM pages
ON CONFLICT (role, page) DO NOTHING;

WITH pages(slug) AS (VALUES
  ('employees'),('attendance'),('leaves'),('leaves-requests'),('payroll'),
  ('holidays'),('holiday-types'),('contracts'),('kpis'),('allowances'),
  ('late-penalties'),('targets-overtime'),('shifts'),('networks'),('geofencing'),
  ('directory'),('employee-access'),('audit'),('reports'),('settings'),('roles')
)
INSERT INTO public.role_permissions (role, page, can_view, can_create, can_edit, can_delete, can_export)
SELECT 'manager'::public.app_role, slug,
  slug IN ('employees','attendance','leaves','leaves-requests','directory','reports','kpis','targets-overtime','shifts'),
  slug IN ('leaves-requests'),
  slug IN ('attendance','leaves-requests','kpis','targets-overtime'),
  false,
  slug IN ('attendance','leaves','reports')
FROM pages
ON CONFLICT (role, page) DO NOTHING;

WITH pages(slug) AS (VALUES
  ('employees'),('attendance'),('leaves'),('leaves-requests'),('payroll'),
  ('holidays'),('holiday-types'),('contracts'),('kpis'),('allowances'),
  ('late-penalties'),('targets-overtime'),('shifts'),('networks'),('geofencing'),
  ('directory'),('employee-access'),('audit'),('reports'),('settings'),('roles')
)
INSERT INTO public.role_permissions (role, page, can_view, can_create, can_edit, can_delete, can_export)
SELECT 'user'::public.app_role, slug,
  slug IN ('directory'),
  false, false, false, false
FROM pages
ON CONFLICT (role, page) DO NOTHING;
