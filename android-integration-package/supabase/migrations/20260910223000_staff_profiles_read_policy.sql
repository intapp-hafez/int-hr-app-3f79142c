-- Ensure staff has NO table-level SELECT access to profiles (only admin, hr, manager, and self can access profiles)
DROP POLICY IF EXISTS "profiles staff read" ON public.profiles;

-- Provide a secure RPC that only returns display names for attendance and leave approvals
-- without exposing full employee profile records to staff
CREATE OR REPLACE FUNCTION public.get_staff_employee_names(p_employee_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  full_name text,
  full_name_ar text,
  email text,
  emp_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has staff, hr, or admin access
  IF NOT (
    public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden: staff access required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(p.full_name_ar), ''), p.email, p.emp_code, 'Employee') AS name,
    p.full_name,
    p.full_name_ar,
    p.email,
    p.emp_code
  FROM public.profiles p
  WHERE (p_employee_ids IS NULL OR p.id = ANY(p_employee_ids));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_staff_employee_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_employee_names(uuid[]) TO authenticated;
