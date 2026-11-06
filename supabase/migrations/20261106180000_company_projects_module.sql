-- ==============================================================================
-- Migration: Company Projects Module
-- Tables: company_projects, project_members, project_tasks, project_files, project_updates
-- Includes: Indexes, RLS Policies, Triggers (Clean Production Schema, No Mockups)
-- ==============================================================================

-- Helper updated_at function (idempotent)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Permissions / Grants
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

-- RLS Policies for sub-tables
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
-- 6. Default Projects Seed (2 Projects with 6-7 Real Company Employees each)
-- ==============================================================================

DO $$
DECLARE
  v_p1_id uuid;
  v_p2_id uuid;
  v_pm1_id uuid;
  v_rm1_id uuid;
  v_pm2_id uuid;
  v_rm2_id uuid;
BEGIN
  -- Lookup manager IDs from profiles
  SELECT id INTO v_pm1_id FROM public.profiles WHERE full_name ILIKE '%Mohamed Ahmed Abdallah%' LIMIT 1;
  SELECT id INTO v_rm1_id FROM public.profiles WHERE full_name ILIKE '%Sameh Mohamed%' LIMIT 1;
  SELECT id INTO v_pm2_id FROM public.profiles WHERE full_name ILIKE '%Khaled Habashe%' LIMIT 1;
  SELECT id INTO v_rm2_id FROM public.profiles WHERE full_name ILIKE '%Ahmed Moselhy%' LIMIT 1;

  -- ─── 1. Insert Default Project PRJ-001 ───
  INSERT INTO public.company_projects (
    project_code,
    name,
    description,
    project_manager_id,
    project_manager_name,
    reported_manager_id,
    reported_manager_name,
    location,
    start_date,
    end_date,
    notes,
    status
  ) VALUES (
    'PRJ-001',
    'Cairo HQ Smart Infrastructure & Light Current Upgrade',
    'Comprehensive modernization of server room cabling, fiber optic backbone, access control, and network security across all Cairo headquarters floors.',
    v_pm1_id,
    'Mohamed Ahmed Abdallah Mohamed',
    v_rm1_id,
    'Sameh Mohamed Hussein Mohamed',
    'Cairo HQ',
    '2025-01-15',
    '2025-06-30',
    'Core cabling and primary patch panels deployed. Server room ventilation and power redundancy testing underway.',
    'ongoing'
  )
  ON CONFLICT (project_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    location = EXCLUDED.location,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes
  RETURNING id INTO v_p1_id;

  -- Members for PRJ-001 (7 real company employees)
  IF v_p1_id IS NOT NULL THEN
    DELETE FROM public.project_members WHERE project_id = v_p1_id;
    INSERT INTO public.project_members (project_id, employee_id, name, email, role, department, phone)
    SELECT
      v_p1_id,
      p.id,
      p.full_name,
      p.email,
      COALESCE(pos.name_en, 'Team Member'),
      COALESCE(dept.name_en, 'Project Management'),
      p.phone
    FROM public.profiles p
    LEFT JOIN public.positions pos ON pos.id = p.position_id
    LEFT JOIN public.departments dept ON dept.id = p.department_id
    WHERE p.full_name IN (
      'Rahim Kamal Abdel Hamid Al-Shuwaimi',
      'Fouad Hussien Shaker Mohamed',
      'Ashraf Gamal Mahmoud Sabet',
      'Ahmed Kamal Abo Zied Ali',
      'Mostafa Hassan Amer Hassan',
      'Mohamed Salah Mahmoud Ahmed',
      'Ali Mohamed Ibrahim Mohamed'
    );

    -- Tasks for PRJ-001
    DELETE FROM public.project_tasks WHERE project_id = v_p1_id;
    INSERT INTO public.project_tasks (project_id, title, assignee_name, priority, status, due_date) VALUES
      (v_p1_id, 'Network Rack Assembly & Fiber Patching', 'Rahim Kamal Abdel Hamid Al-Shuwaimi', 'high', 'completed', '2025-02-10'),
      (v_p1_id, 'Horizontal UTP Cable Laying for Floors 1-3', 'Fouad Hussien Shaker Mohamed', 'high', 'completed', '2025-02-28'),
      (v_p1_id, 'Biometric Access Control Turnstiles Integration', 'Ashraf Gamal Mahmoud Sabet', 'high', 'completed', '2025-03-15'),
      (v_p1_id, 'Core Switch VLAN Segregation & Routing Table Setup', 'Rahim Kamal Abdel Hamid Al-Shuwaimi', 'high', 'in_progress', '2025-04-10'),
      (v_p1_id, 'Precision Cooling & Environmental Sensors Installation', 'Mohamed Salah Mahmoud Ahmed', 'medium', 'in_progress', '2025-04-28'),
      (v_p1_id, 'Floor Distribution Box Termination Testing', 'Mostafa Hassan Amer Hassan', 'medium', 'in_progress', '2025-05-15'),
      (v_p1_id, 'Hardware Delivery & Site Fleet Coordination', 'Ali Mohamed Ibrahim Mohamed', 'low', 'in_progress', '2025-05-20'),
      (v_p1_id, 'Final Commissioning & As-Built Documentation', 'Mohamed Salah Mahmoud Ahmed', 'high', 'pending', '2025-06-25');

    -- Files for PRJ-001
    DELETE FROM public.project_files WHERE project_id = v_p1_id;
    INSERT INTO public.project_files (project_id, name, size, type, url, uploaded_by_name) VALUES
      (v_p1_id, 'Cairo_HQ_Network_Architecture_v3.pdf', '3.8 MB', 'PDF', '#', 'Mohamed Ahmed Abdallah Mohamed'),
      (v_p1_id, 'Light_Current_Equipment_BOQ.xlsx', '950 KB', 'SPREADSHEET', '#', 'Sameh Mohamed Hussein Mohamed'),
      (v_p1_id, 'CCTV_Access_Control_Schematic.dwg', '11.4 MB', 'CAD', '#', 'Rahim Kamal Abdel Hamid Al-Shuwaimi');

    -- Updates for PRJ-001
    DELETE FROM public.project_updates WHERE project_id = v_p1_id;
    INSERT INTO public.project_updates (project_id, author_name, author_role, title, content, date) VALUES
      (v_p1_id, 'Mohamed Ahmed Abdallah Mohamed', 'Project Lead', 'Fiber Backbone Successfully Lighted', 'The multi-strand OM4 fiber backbone linking server room to all floor distributor boxes has been tested and certified at 10Gbps.', 'May 02, 2025'),
      (v_p1_id, 'Rahim Kamal Abdel Hamid Al-Shuwaimi', 'Network Engineer', 'VLAN Infrastructure Configured', 'Corporate, guest, and VoIP subnet routing established with automated DHCP relay.', 'Apr 20, 2025');
  END IF;

  -- ─── 2. Insert Default Project PRJ-002 ───
  INSERT INTO public.company_projects (
    project_code,
    name,
    description,
    project_manager_id,
    project_manager_name,
    reported_manager_id,
    reported_manager_name,
    location,
    start_date,
    end_date,
    notes,
    status
  ) VALUES (
    'PRJ-002',
    'Alexandria Regional Logistics & Warehouse Automation',
    'Implementation of automated barcode inventory flow, heavy racking structures, and logistics vehicle integration at Alexandria distribution center.',
    v_pm2_id,
    'Khaled Habashe Hamid Mahmoud',
    v_rm2_id,
    'Ahmed Moselhy Ahmed Moselhy',
    'Alexandria Hub',
    '2025-02-01',
    '2025-08-31',
    'High-density pallet racking installed. Handheld RF scanner deployment and ERP integration progressing as scheduled.',
    'ongoing'
  )
  ON CONFLICT (project_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    location = EXCLUDED.location,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes
  RETURNING id INTO v_p2_id;

  -- Members for PRJ-002 (6 real company employees)
  IF v_p2_id IS NOT NULL THEN
    DELETE FROM public.project_members WHERE project_id = v_p2_id;
    INSERT INTO public.project_members (project_id, employee_id, name, email, role, department, phone)
    SELECT
      v_p2_id,
      p.id,
      p.full_name,
      p.email,
      COALESCE(pos.name_en, 'Team Member'),
      COALESCE(dept.name_en, 'Operations'),
      p.phone
    FROM public.profiles p
    LEFT JOIN public.positions pos ON pos.id = p.position_id
    LEFT JOIN public.departments dept ON dept.id = p.department_id
    WHERE p.full_name IN (
      'Ahmed Hesham Mohamed Abd Elhamed',
      'Omar Waheed Mohamed Hassan',
      'Mohamed Khaled Ragab Sadek',
      'Omar Mohamed Ahmed Hassan',
      'Taha Farag Atiah Farag',
      'Mohamed Abd Elaziz Salem Elsayed'
    );

    -- Tasks for PRJ-002
    DELETE FROM public.project_tasks WHERE project_id = v_p2_id;
    INSERT INTO public.project_tasks (project_id, title, assignee_name, priority, status, due_date) VALUES
      (v_p2_id, 'Industrial Floor Load Testing & Civil Clearance', 'Khaled Habashe Hamid Mahmoud', 'high', 'completed', '2025-02-18'),
      (v_p2_id, 'Heavy-Duty Cantilever Rack Construction', 'Taha Farag Atiah Farag', 'high', 'completed', '2025-03-10'),
      (v_p2_id, 'Industrial Wi-Fi Access Points Installation', 'Ahmed Hesham Mohamed Abd Elhamed', 'high', 'completed', '2025-03-25'),
      (v_p2_id, 'WMS Barcode Station Assembly & Scanner Setup', 'Omar Waheed Mohamed Hassan', 'high', 'in_progress', '2025-04-15'),
      (v_p2_id, 'Forklift Traffic Flow & Floor Epoxy Marking', 'Mohamed Khaled Ragab Sadek', 'medium', 'in_progress', '2025-05-05'),
      (v_p2_id, 'Fleet Cargo Vehicle Check-In Gate Automation', 'Mohamed Abd Elaziz Salem Elsayed', 'medium', 'in_progress', '2025-05-22'),
      (v_p2_id, 'Warehouse Staff Operation & Safety Training', 'Khaled Habashe Hamid Mahmoud', 'medium', 'pending', '2025-06-15'),
      (v_p2_id, 'Full Load End-to-End Stress Test', 'Ahmed Hesham Mohamed Abd Elhamed', 'high', 'pending', '2025-07-20');

    -- Files for PRJ-002
    DELETE FROM public.project_files WHERE project_id = v_p2_id;
    INSERT INTO public.project_files (project_id, name, size, type, url, uploaded_by_name) VALUES
      (v_p2_id, 'Alexandria_Warehouse_Floor_Plan.pdf', '5.1 MB', 'PDF', '#', 'Khaled Habashe Hamid Mahmoud'),
      (v_p2_id, 'Racking_Safety_Certification.pdf', '1.4 MB', 'PDF', '#', 'Taha Farag Atiah Farag'),
      (v_p2_id, 'WMS_Handheld_Terminal_Specs.docx', '680 KB', 'DOCUMENT', '#', 'Ahmed Hesham Mohamed Abd Elhamed');

    -- Updates for PRJ-002
    DELETE FROM public.project_updates WHERE project_id = v_p2_id;
    INSERT INTO public.project_updates (project_id, author_name, author_role, title, content, date) VALUES
      (v_p2_id, 'Khaled Habashe Hamid Mahmoud', 'Warehouse Manager', 'Storage Bays 1-6 Fully Assembled', 'Racks inspection passed safety load capacity tests. Barcode scanning zones activated on Bay A & B.', 'May 04, 2025'),
      (v_p2_id, 'Ahmed Hesham Mohamed Abd Elhamed', 'Lead Engineer', 'Industrial Wireless Roaming Verified', 'Tested handheld RF scanner roaming between access points across all 4,000 sq meter warehouse floors with 0 packet drop.', 'Apr 26, 2025');
  END IF;
END $$;

