-- Per-employee switch: is an approved device required to check in / out?
-- Off by default; admins turn it on from the employee details page.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_check_required BOOLEAN NOT NULL DEFAULT false;
