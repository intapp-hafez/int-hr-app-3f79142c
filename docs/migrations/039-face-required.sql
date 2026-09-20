-- Per-employee "face recognition required" switch for check-in/out.
-- On by default for all employees (existing and new). Admins can disable
-- it per employee from the employee details page.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS face_required BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.face_required IS
  'When true, the employee must verify their face to check in/out. On by default; admins can disable per employee.';
