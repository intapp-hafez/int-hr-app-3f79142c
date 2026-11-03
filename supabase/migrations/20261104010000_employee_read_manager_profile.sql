-- Allow authenticated employees to read their direct manager's profile record and contact details
CREATE OR REPLACE FUNCTION public.get_my_manager_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manager_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_department_manager_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.responsible_person_id 
  FROM public.departments d
  JOIN public.profiles p ON p.department_id = d.id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "profiles employee read manager" ON public.profiles;

CREATE POLICY "profiles employee read manager" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = public.get_my_manager_id()
    OR id = public.get_my_department_manager_id()
  );

-- Dedicated RPC returning the caller's manager profile (safe subset of fields)
CREATE OR REPLACE FUNCTION public.get_my_manager_profile()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mgr_id uuid;
BEGIN
  -- 1. Check direct manager_id on caller profile
  SELECT manager_id INTO v_mgr_id FROM public.profiles WHERE id = auth.uid();

  -- 2. Fallback to department responsible person
  IF v_mgr_id IS NULL THEN
    SELECT d.responsible_person_id INTO v_mgr_id
    FROM public.departments d
    JOIN public.profiles p ON p.department_id = d.id
    WHERE p.id = auth.uid() AND d.responsible_person_id != auth.uid();
  END IF;

  IF v_mgr_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone
  FROM public.profiles p
  WHERE p.id = v_mgr_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_manager_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_manager_profile() TO authenticated;

