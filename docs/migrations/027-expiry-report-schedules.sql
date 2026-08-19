-- Expiry report scheduling: extend export_schedules with report kind, frequency and window
ALTER TABLE public.export_schedules
  ADD COLUMN IF NOT EXISTS report_kind text NOT NULL DEFAULT 'activity',
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS weekday smallint,
  ADD COLUMN IF NOT EXISTS expiry_days integer NOT NULL DEFAULT 30;

DO $$ BEGIN
  ALTER TABLE public.export_schedules ADD CONSTRAINT export_schedules_report_kind_chk
    CHECK (report_kind IN ('activity','id_expiry','contract_expiry'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.export_schedules ADD CONSTRAINT export_schedules_frequency_chk
    CHECK (frequency IN ('daily','weekly'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.export_schedules ADD CONSTRAINT export_schedules_weekday_chk
    CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.export_schedules ADD CONSTRAINT export_schedules_expiry_days_chk
    CHECK (expiry_days BETWEEN 1 AND 365);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
