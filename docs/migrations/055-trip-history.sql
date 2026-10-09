-- Trip history: every trip creation, status change (start/finish/cancel) and allowance change.
CREATE TABLE IF NOT EXISTS public.trip_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  event text NOT NULL,               -- created | started | finished | cancelled | status | allowance
  from_status text,
  to_status text,
  allowance_before numeric,
  allowance_after numeric,
  allowance_status_before text,
  allowance_status_after text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_history_trip_idx ON public.trip_history(trip_id, created_at DESC);

GRANT SELECT ON public.trip_history TO authenticated;
GRANT ALL ON public.trip_history TO service_role;
ALTER TABLE public.trip_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_history_read" ON public.trip_history;
CREATE POLICY "trip_history_read" ON public.trip_history FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  OR public.has_role(auth.uid(), 'finance')
  OR EXISTS (
    SELECT 1 FROM public.trips t
    LEFT JOIN public.profiles p ON p.id = t.assignee
    WHERE t.id = trip_history.trip_id
      AND (t.created_by = auth.uid() OR t.assignee = auth.uid() OR p.manager_id = auth.uid())
  )
);

-- Rows are written only by this trigger (no direct insert grant).
CREATE OR REPLACE FUNCTION public.tg_log_trip_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO trip_history(trip_id, event, to_status, allowance_after, allowance_status_after, changed_by)
    VALUES (NEW.id, 'created', NEW.status::text, NEW.calculated_allowance, NEW.allowance_status::text, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO trip_history(trip_id, event, from_status, to_status, changed_by)
    VALUES (NEW.id,
      CASE NEW.status::text WHEN 'in_progress' THEN 'started' WHEN 'done' THEN 'finished'
        WHEN 'cancelled' THEN 'cancelled' ELSE 'status' END,
      OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  IF NEW.calculated_allowance IS DISTINCT FROM OLD.calculated_allowance
     OR NEW.allowance_status IS DISTINCT FROM OLD.allowance_status THEN
    INSERT INTO trip_history(trip_id, event, allowance_before, allowance_after,
      allowance_status_before, allowance_status_after, changed_by)
    VALUES (NEW.id, 'allowance', OLD.calculated_allowance, NEW.calculated_allowance,
      OLD.allowance_status::text, NEW.allowance_status::text, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_trip_history ON public.trips;
CREATE TRIGGER trg_trip_history AFTER INSERT OR UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.tg_log_trip_history();
