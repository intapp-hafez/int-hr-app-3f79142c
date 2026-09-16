-- Migration: App Pages Catalog & Dynamic Allowed Pages
-- Creates public.app_pages catalog for tracking navigable pages and modules in the system

CREATE TABLE IF NOT EXISTS public.app_pages (
  slug text PRIMARY KEY,
  label text NOT NULL,
  label_ar text,
  path text NOT NULL,
  category text NOT NULL,
  icon text,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_pages TO authenticated;
GRANT ALL ON public.app_pages TO service_role;
ALTER TABLE public.app_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_pages_read_all"
  ON public.app_pages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "app_pages_admin_write"
  ON public.app_pages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_app_pages_updated_at BEFORE UPDATE ON public.app_pages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed the application pages
INSERT INTO public.app_pages (slug, label, label_ar, path, category, icon, description, is_system, display_order)
VALUES
  -- Core HR & Staffing
  ('employees', 'Employees', 'الموظفون', '/admin/employees', 'core_hr', 'Users', 'Manage employee profiles, documents, and directory', false, 1),
  ('contracts', 'Contracts', 'العقود', '/admin/contracts', 'core_hr', 'FileSignature', 'Employment contracts, renewals, and expiration notifications', false, 2),
  ('directory', 'Directory', 'دليل الشركة', '/admin/directory', 'core_hr', 'Building2', 'Company phonebook, contacts, and branch directories', false, 3),
  ('employee-access', 'Employee Access', 'وصول الموظفين', '/admin/employee-access', 'core_hr', 'KeyRound', 'Employee portal credentials and login permissions', false, 4),

  -- Time & Attendance
  ('attendance', 'Attendance', 'الحضور والانصراف', '/admin/attendance', 'attendance', 'Clock', 'Daily attendance records, biometric logs, and timesheets', false, 10),
  ('leaves', 'Leaves', 'الإجازات', '/admin/leaves', 'attendance', 'CalendarDays', 'Employee leave balances, policies, and calendar', false, 11),
  ('leaves-requests', 'Leave Requests', 'طلبات الإجازة', '/admin/leaves-requests', 'attendance', 'CalendarDays', 'Approve and reject incoming leave requests', false, 12),
  ('shifts', 'Shifts', 'الورديات', '/admin/shifts', 'attendance', 'Clock', 'Shift schedules, rosters, and working hours', false, 13),
  ('holidays', 'Holidays', 'العطل الرسمية', '/admin/holidays', 'attendance', 'CalendarDays', 'Official public and company holidays', false, 14),
  ('holiday-types', 'Holiday Types', 'أنواع العطل', '/admin/holiday-types', 'attendance', 'CalendarDays', 'Custom holiday categories and compensation rules', false, 15),

  -- Payroll & Compensation
  ('payroll', 'Payroll', 'الرواتب', '/admin/payroll', 'finance', 'Wallet', 'Monthly payroll runs, salary slips, and accounting exports', false, 20),
  ('advances', 'Advances', 'السلف المالية', '/admin/advances', 'finance', 'Banknote', 'Salary advance requests, approvals, and deductions', false, 21),
  ('allowances', 'Allowances', 'البدلات', '/admin/allowances', 'finance', 'Calculator', 'Housing, transport, and custom employee allowances', false, 22),
  ('late-penalties', 'Late Penalties', 'جزاءات التأخير', '/admin/late-penalties', 'finance', 'AlertTriangle', 'Late arrival deduction policies and thresholds', false, 23),
  ('targets-overtime', 'Targets / Overtime', 'الأهداف والعمل الإضافي', '/admin/targets-overtime', 'finance', 'TrendingUp', 'Overtime hours and sales targets calculation', false, 24),
  ('kpis', 'KPIs', 'مؤشرات الأداء', '/admin/kpis', 'finance', 'BarChart3', 'Key performance indicators and employee scoring', false, 25),

  -- Workplace & Operations
  ('geofencing', 'Geofencing', 'السياج الجغرافي', '/admin/geofencing', 'operations', 'MapPin', 'GPS boundary locations for mobile clock-in/out', false, 30),
  ('networks', 'Networks & Devices', 'الشبكات والأجهزة', '/admin/networks', 'operations', 'Network', 'Authorized Wi-Fi routers and biometric punch machines', false, 31),
  ('reports', 'Reports', 'التقارير', '/admin/reports', 'operations', 'FileBarChart2', 'Custom analytics, audit summaries, and HR exports', false, 32),
  ('audit', 'Audit Log', 'سجل العمليات', '/admin/audit', 'operations', 'ScrollText', 'System-wide activity, security audit trail, and logs', false, 33),

  -- System & Settings
  ('settings', 'Settings', 'الإعدادات', '/admin/settings', 'settings', 'Settings', 'General system configuration and company profiles', false, 40),
  ('roles', 'Roles & Permissions', 'الأدوار والصلاحيات', '/admin/settings/roles', 'settings', 'Shield', 'Role assignments, allowed pages, and user permissions', false, 41)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  label_ar = EXCLUDED.label_ar,
  path = EXCLUDED.path,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  updated_at = now();
