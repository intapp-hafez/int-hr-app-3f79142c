-- Require returned_by whenever return_date is set, and auto-fill it with the current user
CREATE OR REPLACE FUNCTION public.tg_custody_set_returned_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_name text;
BEGIN
  IF NEW.return_date IS NOT NULL AND (NEW.returned_by IS NULL OR btrim(NEW.returned_by) = '') THEN
    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
      INTO v_name FROM public.profiles p WHERE p.id = auth.uid();
    NEW.returned_by := COALESCE(v_name, 'Unknown');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_custody_set_returned_by ON public.employee_custody;
CREATE TRIGGER employee_custody_set_returned_by
  BEFORE INSERT OR UPDATE ON public.employee_custody
  FOR EACH ROW EXECUTE FUNCTION public.tg_custody_set_returned_by();

UPDATE public.employee_custody
   SET returned_by = 'Unknown'
 WHERE return_date IS NOT NULL AND (returned_by IS NULL OR btrim(returned_by) = '');

ALTER TABLE public.employee_custody
  DROP CONSTRAINT IF EXISTS employee_custody_returned_by_required;
ALTER TABLE public.employee_custody
  ADD CONSTRAINT employee_custody_returned_by_required
  CHECK (return_date IS NULL OR (returned_by IS NOT NULL AND btrim(returned_by) <> ''));
