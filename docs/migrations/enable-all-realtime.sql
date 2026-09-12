-- ==============================================================================
-- Enable Realtime on ALL tables in the 'public' schema for Supabase
-- ==============================================================================

-- 1. Ensure the publication 'supabase_realtime' exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2. Add all existing public tables to supabase_realtime and set REPLICA IDENTITY FULL
-- (REPLICA IDENTITY FULL ensures UPDATE and DELETE events include the complete row data)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  ) LOOP
    -- Set replica identity to full for complete event payloads
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', r.tablename);
    
    -- Add table to publication if not already in it
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', r.tablename);
    EXCEPTION
      WHEN duplicate_object THEN
        -- Already added to publication; continue
        NULL;
    END;
  END LOOP;
END $$;

-- ==============================================================================
-- Verification Query: Check all tables now participating in Realtime
-- ==============================================================================
SELECT 
  schemaname,
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
