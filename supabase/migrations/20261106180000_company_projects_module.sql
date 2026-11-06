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
