-- Migration: 20261125190000_live_employee_tracking_suite.sql
-- Description: Schema for Live Employee Tracking, Route Playback, Geofence Policies, and Location Security Investigation

-- 1. High-frequency employee location pings
CREATE TABLE IF NOT EXISTS public.employee_location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision DEFAULT 5.0,
  speed double precision DEFAULT 0.0,
  heading double precision DEFAULT 0.0,
  altitude double precision DEFAULT 0.0,
  battery_level integer DEFAULT 100,
  is_charging boolean DEFAULT false,
  is_mock boolean DEFAULT false,
  network_type text DEFAULT '4G',
  device_model text,
  os_version text,
  app_version text,
  site_id uuid REFERENCES public.geofence_locations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_location_pings_user_time 
  ON public.employee_location_pings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emp_location_pings_created_at 
  ON public.employee_location_pings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emp_location_pings_site 
  ON public.employee_location_pings(site_id);

-- 2. Enhanced geofence site policies & rules
CREATE TABLE IF NOT EXISTS public.geofence_site_policies (
  site_id uuid PRIMARY KEY REFERENCES public.geofence_locations(id) ON DELETE CASCADE,
  allow_checkin_within_geofence_only boolean NOT NULL DEFAULT true,
  allow_checkout_within_geofence_only boolean NOT NULL DEFAULT true,
  block_checkin_outside_schedule boolean NOT NULL DEFAULT false,
  require_manager_approval boolean NOT NULL DEFAULT false,
  allowed_departments uuid[] DEFAULT '{}',
  site_type text DEFAULT 'Main Office',
  work_schedule_type text DEFAULT 'company_schedule',
  custom_schedule_start time,
  custom_schedule_end time,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3. Location security alerts (anomalies, mock GPS, breaches, impossible travel)
CREATE TABLE IF NOT EXISTS public.location_security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_code text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.geofence_locations(id) ON DELETE SET NULL,
  issue_type text NOT NULL, -- 'geofence_breach', 'impossible_travel', 'mock_location', 'gps_accuracy_weak', 'offline_too_long'
  severity text NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  status text NOT NULL DEFAULT 'under_investigation', -- 'new', 'under_investigation', 'reviewed', 'case_opened', 'dismissed'
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_latitude double precision,
  detected_longitude double precision,
  distance_meters double precision,
  device_signals jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_location_security_alerts_status 
  ON public.location_security_alerts(status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_security_alerts_user 
  ON public.location_security_alerts(user_id, created_at DESC);

-- 4. Location investigation cases & audit notes
CREATE TABLE IF NOT EXISTS public.location_investigation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  alert_id uuid REFERENCES public.location_security_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open', -- 'open', 'pending_employee', 'under_review', 'resolved', 'closed'
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recommended_actions jsonb DEFAULT '[]'::jsonb,
  notes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Enable RLS on all tables
ALTER TABLE public.employee_location_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_site_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_investigation_cases ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.employee_location_pings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_site_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_security_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_investigation_cases TO authenticated;

-- RLS Policies
-- Pings: User can insert own pings; Admins/HR/Managers can read
DROP POLICY IF EXISTS "pings_insert_self" ON public.employee_location_pings;
CREATE POLICY "pings_insert_self" ON public.employee_location_pings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "pings_select_authorized" ON public.employee_location_pings;
CREATE POLICY "pings_select_authorized" ON public.employee_location_pings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Policies: Admin/HR can manage, authenticated can read
DROP POLICY IF EXISTS "policies_select_all" ON public.geofence_site_policies;
CREATE POLICY "policies_select_all" ON public.geofence_site_policies
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "policies_manage_admin_hr" ON public.geofence_site_policies;
CREATE POLICY "policies_manage_admin_hr" ON public.geofence_site_policies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Alerts: Admin/HR/Manager can view, Admin/HR can manage
DROP POLICY IF EXISTS "alerts_select_authorized" ON public.location_security_alerts;
CREATE POLICY "alerts_select_authorized" ON public.location_security_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "alerts_manage_admin_hr" ON public.location_security_alerts;
CREATE POLICY "alerts_manage_admin_hr" ON public.location_security_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Cases: Admin/HR can manage, manager can view
DROP POLICY IF EXISTS "cases_select_authorized" ON public.location_investigation_cases;
CREATE POLICY "cases_select_authorized" ON public.location_investigation_cases
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "cases_manage_admin_hr" ON public.location_investigation_cases;
CREATE POLICY "cases_manage_admin_hr" ON public.location_investigation_cases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
