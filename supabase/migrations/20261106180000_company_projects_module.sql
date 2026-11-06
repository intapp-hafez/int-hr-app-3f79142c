-- ==============================================================================
-- Migration: Company Projects Module
-- Tables: company_projects, project_members, project_tasks, project_files, project_updates
-- Includes: Indexes, RLS Policies, Triggers, and Default Seed Data
-- ==============================================================================

-- 1. company_projects table
CREATE TABLE IF NOT EXISTS public.company_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  project_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_manager_name text NOT NULL DEFAULT '',
  reported_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_manager_name text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT 'Head Office',
  start_date date,
  end_date date,
  notes text,
  status text NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'upcoming', 'completed', 'on_hold')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 2. project_members table
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.company_projects(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'Team Member',
  department text,
  phone text,
  avatar_url text,
  joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 3. project_tasks table
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.company_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_name text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  due_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 4. project_files table
CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.company_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  size text NOT NULL DEFAULT '0 KB',
  type text NOT NULL DEFAULT 'DOCUMENT',
  url text NOT NULL DEFAULT '#',
  uploaded_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by_name text NOT NULL DEFAULT 'Administrator',
  uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 5. project_updates table
CREATE TABLE IF NOT EXISTS public.project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.company_projects(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'Project Manager',
  author_avatar text,
  title text NOT NULL,
  content text NOT NULL,
  date text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_projects_code ON public.company_projects(project_code);
CREATE INDEX IF NOT EXISTS idx_company_projects_status ON public.company_projects(status);
CREATE INDEX IF NOT EXISTS idx_company_projects_pm ON public.company_projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_project_members_proj ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_emp ON public.project_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_proj ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_files_proj ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_proj ON public.project_updates(project_id);

-- Grants
GRANT ALL ON public.company_projects TO authenticated, service_role;
GRANT ALL ON public.project_members TO authenticated, service_role;
GRANT ALL ON public.project_tasks TO authenticated, service_role;
GRANT ALL ON public.project_files TO authenticated, service_role;
GRANT ALL ON public.project_updates TO authenticated, service_role;

-- Enable Row Level Security
ALTER TABLE public.company_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_projects
DROP POLICY IF EXISTS "company_projects_admin_all" ON public.company_projects;
CREATE POLICY "company_projects_admin_all" ON public.company_projects
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "company_projects_manager_read" ON public.company_projects;
CREATE POLICY "company_projects_manager_read" ON public.company_projects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
  );

DROP POLICY IF EXISTS "company_projects_manager_modify" ON public.company_projects;
CREATE POLICY "company_projects_manager_modify" ON public.company_projects
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND (
      project_manager_id = auth.uid() OR reported_manager_id = auth.uid() OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
  );

DROP POLICY IF EXISTS "company_projects_member_read" ON public.company_projects;
CREATE POLICY "company_projects_member_read" ON public.company_projects
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT project_id FROM public.project_members WHERE employee_id = auth.uid())
  );

-- RLS Policies for sub-tables (project_members, project_tasks, project_files, project_updates)
-- Admin & HR full access
DROP POLICY IF EXISTS "project_members_admin_all" ON public.project_members;
CREATE POLICY "project_members_admin_all" ON public.project_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "project_members_authenticated_select" ON public.project_members;
CREATE POLICY "project_members_authenticated_select" ON public.project_members FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "project_tasks_admin_all" ON public.project_tasks;
CREATE POLICY "project_tasks_admin_all" ON public.project_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "project_tasks_manager_all" ON public.project_tasks;
CREATE POLICY "project_tasks_manager_all" ON public.project_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "project_tasks_assignee_read_update" ON public.project_tasks;
CREATE POLICY "project_tasks_assignee_read_update" ON public.project_tasks FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "project_files_all_authenticated" ON public.project_files;
CREATE POLICY "project_files_all_authenticated" ON public.project_files FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_updates_all_authenticated" ON public.project_updates;
CREATE POLICY "project_updates_all_authenticated" ON public.project_updates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Updated_at triggers
DROP TRIGGER IF EXISTS tg_company_projects_updated_at ON public.company_projects;
CREATE TRIGGER tg_company_projects_updated_at
  BEFORE UPDATE ON public.company_projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS tg_project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER tg_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ==============================================================================
-- 6. Seed Data (PRJ-001 through PRJ-005)
-- ==============================================================================

DO $$
DECLARE
  v_p1_id uuid;
  v_p2_id uuid;
  v_p3_id uuid;
  v_p4_id uuid;
  v_p5_id uuid;
BEGIN
  -- Insert PRJ-001
  INSERT INTO public.company_projects (
    project_code, name, description, project_manager_name, reported_manager_name,
    location, start_date, end_date, notes, status
  ) VALUES (
    'PRJ-001', 'Head Office Renovation', 'Full interior renovation, HVAC upgrades, and energy efficiency overhaul.',
    'John Reyes', 'Maria Santos', 'Head Office', '2025-01-15', '2025-04-30',
    'Structural phase complete. HVAC and lighting installations ongoing.', 'ongoing'
  )
  ON CONFLICT (project_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status
  RETURNING id INTO v_p1_id;

  -- Insert PRJ-002
  INSERT INTO public.company_projects (
    project_code, name, description, project_manager_name, reported_manager_name,
    location, start_date, end_date, notes, status
  ) VALUES (
    'PRJ-002', 'Branch Expansion - Cebu', 'Expansion of operations in Cebu, including office setup, manpower deployment, and system integration.',
    'Liza Cortez', 'Carlos Medina', 'Cebu', '2025-02-01', '2025-06-30',
    'Expansion of operations in Cebu, including office setup, manpower deployment, and system integration.', 'ongoing'
  )
  ON CONFLICT (project_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status
  RETURNING id INTO v_p2_id;

  -- Insert PRJ-003
  INSERT INTO public.company_projects (
    project_code, name, description, project_manager_name, reported_manager_name,
    location, start_date, end_date, notes, status
  ) VALUES (
    'PRJ-003', 'IT System Upgrade', 'Complete ERP modernization and cloud migration.',
    'Mark Villanueva', 'Maria Santos', 'Head Office', '2025-03-10', '2025-05-15',
    'Completed ahead of schedule. All systems running nominal.', 'completed'
  )
  ON CONFLICT (project_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status
  RETURNING id INTO v_p3_id;

  -- Insert PRJ-004
  INSERT INTO public.company_projects (
    project_code, name, description, project_manager_name, reported_manager_name,
    location, start_date, end_date, notes, status
  ) VALUES (
    'PRJ-004', 'Warehouse Improvement', 'Modern rack installation and logistics automated barcode tracking.',
    'Anna Dela Cruz', 'Carlos Medina', 'Laguna', '2025-04-01', '2025-08-31',
    'Racks ordered. Site preparation underway.', 'ongoing'
  )
  ON CONFLICT (project_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status
  RETURNING id INTO v_p4_id;

  -- Insert PRJ-005
  INSERT INTO public.company_projects (
    project_code, name, description, project_manager_name, reported_manager_name,
    location, start_date, end_date, notes, status
  ) VALUES (
    'PRJ-005', 'New Office Setup - Davao', 'New regional branch setup in Davao City with initial 25 headcounts.',
    'Ramon Bautista', 'Maria Santos', 'Davao', '2025-05-01', '2025-07-31',
    'Planning stage and lease negotiation in progress.', 'upcoming'
  )
  ON CONFLICT (project_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status
  RETURNING id INTO v_p5_id;

  -- Seed Tasks for PRJ-002
  IF v_p2_id IS NOT NULL THEN
    DELETE FROM public.project_tasks WHERE project_id = v_p2_id;
    INSERT INTO public.project_tasks (project_id, title, assignee_name, priority, status, due_date) VALUES
      (v_p2_id, 'Lease Contract Signing & Legal Filing', 'Liza Cortez', 'high', 'completed', '2025-02-10'),
      (v_p2_id, 'Telecom & Fiber Optic Line Setup', 'Michael Chang', 'high', 'completed', '2025-02-22'),
      (v_p2_id, 'Workstation Furniture Assembly', 'Khaled Nabil', 'medium', 'completed', '2025-03-05'),
      (v_p2_id, 'Fire Safety & Access Control Commissioning', 'Rami Youssef', 'high', 'completed', '2025-03-20'),
      (v_p2_id, 'Core Server Rack Installation', 'Michael Chang', 'high', 'completed', '2025-04-02'),
      (v_p2_id, 'Local Staff Onboarding & Induction', 'Fatima Al-Zahra', 'medium', 'in_progress', '2025-04-25'),
      (v_p2_id, 'CCTV Camera Placement & Testing', 'Rami Youssef', 'high', 'in_progress', '2025-05-05'),
      (v_p2_id, 'ERP & POS Synchronization', 'Michael Chang', 'high', 'in_progress', '2025-05-18'),
      (v_p2_id, 'Signage & Brand Guidelines Fit-Out', 'Khaled Nabil', 'low', 'in_progress', '2025-05-25'),
      (v_p2_id, 'Emergency Power & UPS Testing', 'Rami Youssef', 'medium', 'in_progress', '2025-06-05'),
      (v_p2_id, 'Vendor Service Level Agreements', 'Liza Cortez', 'medium', 'in_progress', '2025-06-12'),
      (v_p2_id, 'Final Municipality Permits Approval', 'Liza Cortez', 'high', 'pending', '2025-06-18'),
      (v_p2_id, 'Mock Operational Run & Stress Test', 'Liza Cortez', 'high', 'pending', '2025-06-24'),
      (v_p2_id, 'Official Grand Opening Ceremony', 'Fatima Al-Zahra', 'medium', 'pending', '2025-06-30');

    -- Seed Members for PRJ-002
    DELETE FROM public.project_members WHERE project_id = v_p2_id;
    INSERT INTO public.project_members (project_id, name, email, role, department, phone) VALUES
      (v_p2_id, 'Liza Cortez', 'l.cortez@al-int.com', 'Project Manager', 'Operations', '+63 917 123 4567'),
      (v_p2_id, 'Michael Chang', 'm.chang@al-int.com', 'Senior IT Infrastructure Lead', 'IT & Tech', '+63 918 234 5678'),
      (v_p2_id, 'Fatima Al-Zahra', 'f.alzahra@al-int.com', 'HR & Talent Partner', 'Human Resources', '+63 919 345 6789'),
      (v_p2_id, 'Rami Youssef', 'r.youssef@al-int.com', 'Security & Compliance Specialist', 'Operations', '+63 920 456 7890'),
      (v_p2_id, 'Khaled Nabil', 'k.nabil@al-int.com', 'Facilities Coordinator', 'General Admin', '+63 921 567 8901'),
      (v_p2_id, 'Sarah Jenkins', 's.jenkins@al-int.com', 'Procurement Specialist', 'Finance', '+63 922 678 9012');

    -- Seed Files for PRJ-002
    DELETE FROM public.project_files WHERE project_id = v_p2_id;
    INSERT INTO public.project_files (project_id, name, size, type, url, uploaded_by_name) VALUES
      (v_p2_id, 'Cebu_Branch_Architectural_Layout_v2.pdf', '4.2 MB', 'PDF', '#', 'Liza Cortez'),
      (v_p2_id, 'Signed_Commercial_Lease_Agreement.pdf', '8.5 MB', 'PDF', '#', 'Liza Cortez'),
      (v_p2_id, 'Network_Infrastructure_Schematics.dwg', '12.8 MB', 'CAD', '#', 'Michael Chang'),
      (v_p2_id, 'Fire_Safety_Inspection_Certificate_2025.pdf', '1.1 MB', 'PDF', '#', 'Rami Youssef'),
      (v_p2_id, 'Branch_Expansion_Budget_Breakdown_Q2.xlsx', '850 KB', 'SPREADSHEET', '#', 'Sarah Jenkins'),
      (v_p2_id, 'Branch_Staffing_Plan_and_Hiring_Roster.docx', '420 KB', 'DOCUMENT', '#', 'Fatima Al-Zahra');

    -- Seed Updates for PRJ-002
    DELETE FROM public.project_updates WHERE project_id = v_p2_id;
    INSERT INTO public.project_updates (project_id, author_name, author_role, title, content, date) VALUES
      (v_p2_id, 'Liza Cortez', 'Project Manager', 'Server Rack & Core IT Line Fully Powered', 'The dedicated server room has completed electrical tests and primary fiber optic line was activated with 1Gbps uplink speed.', 'May 02, 2025'),
      (v_p2_id, 'Michael Chang', 'Lead IT Systems', 'ERP Data Sync Pipeline Operational', 'Configured the site VPN tunnel and tested local POS terminal sync back to corporate HQ database without latency spikes.', 'Apr 28, 2025'),
      (v_p2_id, 'Fatima Al-Zahra', 'HR Specialist', 'Batch 1 Site Engineers Onboarded', 'First cohort of 6 site technicians and branch customer representatives finished corporate onboarding curriculum today.', 'Apr 20, 2025'),
      (v_p2_id, 'Rami Youssef', 'Compliance Officer', 'Fire Safety & Municipal Permits Cleared', 'City inspectors issued preliminary operation clearance certificate. Final stamped license expected next week.', 'Apr 11, 2025'),
      (v_p2_id, 'Liza Cortez', 'Project Manager', 'Office Furniture Fit-Out 100% Completed', 'Desks, ergonomic chairs, and conference room media stations are assembled and inspected.', 'Mar 29, 2025');
  END IF;
END $$;

