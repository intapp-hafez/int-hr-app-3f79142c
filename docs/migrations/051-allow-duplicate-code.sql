-- Migration: Allow duplicate code across directory tables (positions, departments, job_grades, etc.)
-- Drops unique constraints and unique indexes on the 'code' column.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop any unique constraints on 'code' column in public tables
  FOR r IN (
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name = 'code'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I CASCADE', r.table_name, r.constraint_name);
  END LOOP;

  -- Also drop any unique indexes on 'code'
  FOR r IN (
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ~* '\\(.*\\mcode\\M.*\\)'
  ) LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I CASCADE', r.indexname);
  END LOOP;
END $$;
