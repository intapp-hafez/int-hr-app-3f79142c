-- Phase 3: Leave Types Cleanup
-- Deactivate all old leave types
UPDATE public.leave_types SET active = false;

DO $$ 
DECLARE
    lt text;
    types text[] := ARRAY['Annual leaves', 'Emergency leaves', 'Unpaid Leaves', 'Sick leaves', 'Holidays', 'Site leave'];
BEGIN
    FOREACH lt IN ARRAY types
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.leave_types WHERE name = lt) THEN
            INSERT INTO public.leave_types (name, annual_days, paid, active, requires_proof)
            VALUES (
                lt,
                CASE lt WHEN 'Annual leaves' THEN 21 WHEN 'Emergency leaves' THEN 6 WHEN 'Sick leaves' THEN 15 ELSE 0 END,
                CASE lt WHEN 'Unpaid Leaves' THEN false ELSE true END,
                true,
                CASE lt WHEN 'Sick leaves' THEN true ELSE false END
            );
        END IF;
    END LOOP;
END $$;

-- If they already exist but were deactivated, reactivate them:
UPDATE public.leave_types 
SET active = true 
WHERE name IN ('Annual leaves', 'Emergency leaves', 'Unpaid Leaves', 'Sick leaves', 'Holidays', 'Site leave');
