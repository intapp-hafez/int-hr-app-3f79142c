-- Migration: 045-seed-org-structure
-- Description: Add structural columns and seed org chart

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.departments(id);

ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS reports_to_position_id uuid REFERENCES public.positions(id);

-- 1. Insert Departments (Level 1 - No Parent)
INSERT INTO public.departments (code, name_en, name_ar, sort_order) VALUES ('100', 'Executive Management', 'Executive Management', 100) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;

-- 2. Insert Departments (Level 2+ - With Parent)

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Executive Management' OR code = (SELECT code FROM public.departments WHERE name_en = 'Executive Management' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('101', 'Executive Office', 'Executive Office', 101, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Executive Management' OR code = (SELECT code FROM public.departments WHERE name_en = 'Executive Management' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('102', 'Human Resources', 'Human Resources', 102, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Executive Management' OR code = (SELECT code FROM public.departments WHERE name_en = 'Executive Management' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('103', 'Administrative', 'Administrative', 103, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Executive Management' OR code = (SELECT code FROM public.departments WHERE name_en = 'Executive Management' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('104', 'Finance', 'Finance', 104, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Administrative' OR code = (SELECT code FROM public.departments WHERE name_en = 'Administrative' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('105', 'Logistic & Supply Chain', 'Logistic & Supply Chain', 105, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Executive Management' OR code = (SELECT code FROM public.departments WHERE name_en = 'Executive Management' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('106', 'Sales', 'Sales', 106, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Executive Management' OR code = (SELECT code FROM public.departments WHERE name_en = 'Executive Management' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('200', 'Technical', 'Technical', 200, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Technical' OR code = (SELECT code FROM public.departments WHERE name_en = 'Technical' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('201', 'Engineering', 'Engineering', 201, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Technical' OR code = (SELECT code FROM public.departments WHERE name_en = 'Technical' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('202', 'Implementation & Maintenance', 'Implementation & Maintenance', 202, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Technical' OR code = (SELECT code FROM public.departments WHERE name_en = 'Technical' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('203', 'Pre-Sales', 'Pre-Sales', 203, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Executive Management' OR code = (SELECT code FROM public.departments WHERE name_en = 'Executive Management' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('204', 'Project Management', 'Project Management', 204, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = 'Technical' OR code = (SELECT code FROM public.departments WHERE name_en = 'Technical' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('205', 'Infrastructure (IT)', 'Infrastructure (IT)', 205, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;

-- 3. Insert Positions (without reports_to)
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('CEO', 'Chief Executive Officer', 'Chief Executive Officer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('CTO', 'Chief Technical Officer', 'Chief Technical Officer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('EOC', 'Executive Operations Control', 'Executive Operations Control', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('OM', 'Office Manager', 'Office Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PUR', 'Public Relations Specialist', 'Public Relations Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('HRD', 'Human Resources Director', 'Human Resources Director', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('HRM', 'Human Resources Manager', 'Human Resources Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('HRL', 'Human Resources Leader', 'Human Resources Leader', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('HRS-II', 'Sr. Human Resources Specialist', 'Sr. Human Resources Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('HRS', 'Human Resources Specialist', 'Human Resources Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('HRC', 'Human Resource Coordinator', 'Human Resource Coordinator', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('ADM', 'Administration Manager', 'Administration Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('ADO', 'Administartion Officer', 'Administartion Officer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('ADA', 'Admin Assist', 'Admin Assist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('BUS', 'Buffit Supervisor', 'Buffit Supervisor', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('BUW', 'Buffit Worker', 'Buffit Worker', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('FCM', 'Finance Manager', 'Finance Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('ACM', 'Accounting Manager', 'Accounting Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('ACR', 'Accounts Receivable Specialist', 'Accounts Receivable Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('ACP', 'Account Payable Specialist', 'Account Payable Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('ACTR', 'Treasury Accountant', 'Treasury Accountant', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('ACDE', 'Accountant Data Entry', 'Accountant Data Entry', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('LGM', 'Logistic Manager', 'Logistic Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('LGS', 'Logistic specialist', 'Logistic specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PUM', 'Purchasing Manager', 'Purchasing Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PUS', 'Purchasing Supervisor', 'Purchasing Supervisor', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PUS-II', 'Sr. Purchasing Specialist', 'Sr. Purchasing Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PUS', 'Purchasing Specialist', 'Purchasing Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('FTO', 'Fleet Officer', 'Fleet Officer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('DV', 'Driver', 'Driver', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('SLM', 'Sales Manager', 'Sales Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('SLAM', 'Sales Accounts Manager', 'Sales Accounts Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('SLC', 'Sales Coordinator', 'Sales Coordinator', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('TCHD', 'Technical Director', 'Technical Director', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('EBUM', 'Engineering  Business Unit Manager', 'Engineering  Business Unit Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('TCHA', 'Technical Personal Assist', 'Technical Personal Assist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('END', 'Engineering Director', 'Engineering Director', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('TCHSM', 'Technical Site Manager', 'Technical Site Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('SE-II', 'Sr. Site Engineer', 'Sr. Site Engineer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('SE', 'Site Engineer', 'Site Engineer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('SRM', 'Implementation & Maintenance Manager', 'Implementation & Maintenance Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('SMM', 'Service Maintenance Manager', 'Service Maintenance Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('TECS', 'Technical Supervisor', 'Technical Supervisor', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('TEC', 'Technician', 'Technician', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PSM', 'Pre-Sales Manager', 'Pre-Sales Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PSTL', 'Pre-Sales Team Leader', 'Pre-Sales Team Leader', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PSE-II', 'Sr. Pre-Sales Engineer', 'Sr. Pre-Sales Engineer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PSE', 'Pre-Sales Engineer', 'Pre-Sales Engineer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PMD', 'Project Management Director', 'Project Management Director', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PM', 'Project Manager', 'Project Manager', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PMC', 'Project Management Coordinator', 'Project Management Coordinator', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PSE-II', 'Sr. Project Site Engineer', 'Sr. Project Site Engineer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PSE', 'Project Site Engineer', 'Project Site Engineer', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PTECHS', 'Project Technical Supervisor', 'Project Technical Supervisor', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('PTECH', 'Project Technician', 'Project Technician', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('IT-II', 'Sr. IT Specialist', 'Sr. IT Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;
INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('IT', 'IT Specialist', 'IT Specialist', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;

-- 4. Update Positions (with reports_to)

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'CTO';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'EOC';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'OM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PUR';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'HRD';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'HRD';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'HRM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'HRM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'HRL';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'HRL';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'HRS-II';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'HRL';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'HRS';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'HRL';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'HRC';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'ADM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ADM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'ADO';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ADO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'ADA';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ADO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'BUS';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'BUS';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'BUW';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'FCM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'FCM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'ACM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ACM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'ACR';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ACM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'ACP';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ACM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'ACTR';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ACM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'ACDE';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ADM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'LGM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'LGM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'LGS';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ADM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PUM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PUM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PUS';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PUM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PUS-II';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PUM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PUS';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'ADM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'FTO';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'FTO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'DV';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'SLM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'SLM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'SLAM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'SLAM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'SLC';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CTO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'TCHD';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CTO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'EBUM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'TCHD';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'TCHA';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'TCHD';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'END';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'END';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'TCHSM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'TCHSM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'SE-II';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'TCHSM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'SE';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'END';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'SRM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'END';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'SMM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'SRM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'TECS';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'SRM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'TEC';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CTO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PSM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PSM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PSTL';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PSTL';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PSE-II';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PSTL';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PSE';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'CEO';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PMD';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PMD';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PM';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PMC';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PSE-II';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PSE';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PTECHS';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'PM';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'PTECH';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'TCHD';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'IT-II';
END $$;

DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = 'TCHD';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = 'IT';
END $$;

-- 5. Insert Department Positions

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '100';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'CEO';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'C';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '100';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'CTO';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'C';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '101';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'EOC';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '101';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'OM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '101';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PUR';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '101';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'HRD';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'D';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '102';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'HRM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'M';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '102';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'HRL';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'TL';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '102';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'HRS-II';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '102';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'HRS';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '102';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'HRC';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '103';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'ADM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'M';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '103';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'ADO';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '103';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'ADA';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '103';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'BUS';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'WR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '103';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'BUW';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'WR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '104';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'FCM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'M';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '104';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'ACM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'UM';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '104';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'ACR';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '104';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'ACP';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '104';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'ACTR';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '104';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'ACDE';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '105';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'LGM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'UM';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '105';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'LGS';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '105';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PUM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'UM';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '105';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PUS';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SUP';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '105';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PUS-II';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '105';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PUS';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '105';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'FTO';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'UM';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '105';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'DV';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'WR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '106';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'SLM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'M';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '106';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'SLAM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'UM';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '106';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'SLC';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '200';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'TCHD';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'D';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '200';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'EBUM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'UM';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '200';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'TCHA';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '201';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'END';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'D';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '201';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'TCHSM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'PM';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '201';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'SE-II';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '201';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'SE';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '202';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'SRM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'M';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '202';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'SMM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'M';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '202';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'TECS';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SUP';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '202';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'TEC';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'WR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '203';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PSM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'M';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '203';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PSTL';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'TL';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '203';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PSE-II';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '203';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PSE';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '204';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PMD';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'D';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '204';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PM';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'UM';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '204';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PMC';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '204';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PSE-II';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '204';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PSE';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '204';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PTECHS';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SUP';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '204';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'PTECH';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'WR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '205';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'IT-II';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'SR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;

DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '205';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = 'IT';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = 'JR';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;