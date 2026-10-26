
-- Leave balances per employee/leave_type/year
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  total_days integer NOT NULL DEFAULT 0,
  used_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own balances" ON public.leave_balances
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE POLICY "Admin/HR manage balances" ON public.leave_balances
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE TRIGGER trg_leave_balances_updated BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed balances for any existing employees from active leave types
INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days)
SELECT p.id, lt.id, EXTRACT(YEAR FROM now())::int, lt.annual_days
FROM public.profiles p
CROSS JOIN public.leave_types lt
WHERE lt.active = true
ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

-- Function: seed balances for a new profile
CREATE OR REPLACE FUNCTION public.seed_leave_balances_for_employee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days)
  SELECT NEW.id, lt.id, EXTRACT(YEAR FROM now())::int, lt.annual_days
  FROM public.leave_types lt WHERE lt.active = true
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_leave_balances ON public.profiles;
CREATE TRIGGER trg_seed_leave_balances AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_leave_balances_for_employee();

-- Function: seed balances for new leave type across employees
CREATE OR REPLACE FUNCTION public.seed_leave_balances_for_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active THEN
    INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days)
    SELECT p.id, NEW.id, EXTRACT(YEAR FROM now())::int, NEW.annual_days
    FROM public.profiles p
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_balances_for_type ON public.leave_types;
CREATE TRIGGER trg_seed_balances_for_type AFTER INSERT ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION public.seed_leave_balances_for_type();

-- Apply/restore used_days on leave status change
CREATE OR REPLACE FUNCTION public.apply_leave_balance_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr integer := EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date))::int;
  was_approved boolean := (TG_OP = 'UPDATE' AND OLD.status = 'approved');
  is_approved  boolean := (TG_OP <> 'DELETE' AND NEW.status = 'approved');
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' AND OLD.leave_type_id IS NOT NULL THEN
      UPDATE public.leave_balances SET used_days = GREATEST(0, used_days - OLD.days)
      WHERE employee_id = OLD.employee_id AND leave_type_id = OLD.leave_type_id AND year = yr;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.leave_type_id IS NULL THEN RETURN NEW; END IF;

  IF is_approved AND NOT was_approved THEN
    INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days, used_days)
    VALUES (NEW.employee_id, NEW.leave_type_id, yr, 0, NEW.days)
    ON CONFLICT (employee_id, leave_type_id, year)
    DO UPDATE SET used_days = public.leave_balances.used_days + NEW.days;
  ELSIF was_approved AND NOT is_approved THEN
    UPDATE public.leave_balances SET used_days = GREATEST(0, used_days - OLD.days)
    WHERE employee_id = OLD.employee_id AND leave_type_id = OLD.leave_type_id AND year = yr;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_apply_leave_balance ON public.leaves;
CREATE TRIGGER trg_apply_leave_balance
AFTER INSERT OR UPDATE OF status OR DELETE ON public.leaves
FOR EACH ROW EXECUTE FUNCTION public.apply_leave_balance_change();
