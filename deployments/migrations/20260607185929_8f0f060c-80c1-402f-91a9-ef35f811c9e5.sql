
-- 1) Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- 2) Directory tables
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dept read auth" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept admin write" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos read auth" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "pos admin write" ON public.positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_positions_updated BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "city read auth" ON public.cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "city admin write" ON public.cities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name_en text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_districts_city ON public.districts(city_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.districts TO authenticated;
GRANT ALL ON public.districts TO service_role;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dist read auth" ON public.districts FOR SELECT TO authenticated USING (true);
CREATE POLICY "dist admin write" ON public.districts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_districts_updated BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  annual_days int NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lt read auth" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "lt admin write" ON public.leave_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_leave_types_updated BEFORE UPDATE ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Profile FKs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id   uuid REFERENCES public.positions(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id       uuid REFERENCES public.cities(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id   uuid REFERENCES public.districts(id)   ON DELETE SET NULL;

-- 4) Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  in_time timestamptz,
  out_time timestamptz,
  branch text,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','absent','leave')),
  lat double precision,
  lng double precision,
  network_ok boolean,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_emp ON public.attendance(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att read scope" ON public.attendance FOR SELECT TO authenticated USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = attendance.employee_id AND p.manager_id = auth.uid())
);
CREATE POLICY "att self insert" ON public.attendance FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "att self update" ON public.attendance FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "att admin delete" ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Leaves
CREATE TABLE IF NOT EXISTS public.leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE SET NULL,
  leave_type_name text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days int NOT NULL DEFAULT 1,
  paid boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reason text,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leaves_emp ON public.leaves(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaves TO authenticated;
GRANT ALL ON public.leaves TO service_role;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaves read scope" ON public.leaves FOR SELECT TO authenticated USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
);
CREATE POLICY "leaves self insert" ON public.leaves FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "leaves update scope" ON public.leaves FOR UPDATE TO authenticated USING (
  employee_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
) WITH CHECK (true);
CREATE POLICY "leaves admin delete" ON public.leaves FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leaves
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6) Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  due_date date,
  due_time text,
  city text,
  district text,
  address text,
  estimated_hours numeric,
  assignees uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assignees ON public.tasks USING gin(assignees);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks read scope" ON public.tasks FOR SELECT TO authenticated USING (
  created_by = auth.uid()
  OR auth.uid() = ANY (assignees)
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR public.has_role(auth.uid(),'manager')
);
CREATE POLICY "tasks manager insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
CREATE POLICY "tasks update scope" ON public.tasks FOR UPDATE TO authenticated USING (
  created_by = auth.uid()
  OR auth.uid() = ANY (assignees)
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
) WITH CHECK (true);
CREATE POLICY "tasks delete admin" ON public.tasks FOR DELETE TO authenticated USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7) Trips
CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination text NOT NULL,
  address text,
  trip_date date NOT NULL,
  trip_time text,
  purpose text,
  notes text,
  assignee uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trips_assignee ON public.trips(assignee);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips read scope" ON public.trips FOR SELECT TO authenticated USING (
  assignee = auth.uid()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR public.has_role(auth.uid(),'manager')
);
CREATE POLICY "trips manager insert" ON public.trips FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
CREATE POLICY "trips update scope" ON public.trips FOR UPDATE TO authenticated USING (
  assignee = auth.uid()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
) WITH CHECK (true);
CREATE POLICY "trips delete" ON public.trips FOR DELETE TO authenticated USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
);
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
