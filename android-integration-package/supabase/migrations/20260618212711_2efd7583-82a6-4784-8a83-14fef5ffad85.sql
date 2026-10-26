CREATE OR REPLACE FUNCTION public.apply_leave_balance_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  yr integer := EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date))::int;
  was_approved boolean := (TG_OP = 'UPDATE' AND OLD.status = 'approved');
  is_approved  boolean := (TG_OP <> 'DELETE' AND NEW.status = 'approved');
  resolved_type_id uuid;
  old_type_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_type_id := OLD.leave_type_id;
    IF old_type_id IS NULL AND OLD.leave_type_name IS NOT NULL THEN
      SELECT id INTO old_type_id FROM public.leave_types
        WHERE active = true AND lower(name) = lower(OLD.leave_type_name) LIMIT 1;
    END IF;
    IF OLD.status = 'approved' AND old_type_id IS NOT NULL THEN
      UPDATE public.leave_balances SET used_days = GREATEST(0, used_days - OLD.days)
      WHERE employee_id = OLD.employee_id AND leave_type_id = old_type_id AND year = yr;
    END IF;
    RETURN OLD;
  END IF;

  resolved_type_id := NEW.leave_type_id;
  IF resolved_type_id IS NULL AND NEW.leave_type_name IS NOT NULL THEN
    SELECT id INTO resolved_type_id FROM public.leave_types
      WHERE active = true AND lower(name) = lower(NEW.leave_type_name) LIMIT 1;
  END IF;

  IF resolved_type_id IS NULL THEN RETURN NEW; END IF;

  IF is_approved AND NOT was_approved THEN
    INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days, used_days)
    VALUES (NEW.employee_id, resolved_type_id, yr, 0, NEW.days)
    ON CONFLICT (employee_id, leave_type_id, year)
    DO UPDATE SET used_days = public.leave_balances.used_days + NEW.days;
  ELSIF was_approved AND NOT is_approved THEN
    old_type_id := COALESCE(OLD.leave_type_id, resolved_type_id);
    UPDATE public.leave_balances SET used_days = GREATEST(0, used_days - OLD.days)
    WHERE employee_id = OLD.employee_id AND leave_type_id = old_type_id AND year = yr;
  END IF;
  RETURN NEW;
END $function$;