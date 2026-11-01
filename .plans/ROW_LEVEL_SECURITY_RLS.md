# INT HR System — Row-Level Security (RLS) Policies & Access Control Matrix

> **System Version:** 2.6.0  
> **Security Model:** Defense-in-Depth, Database-Enforced Row-Level Security  
> **Target Engine:** Supabase PostgreSQL  
> **Generated:** November 2026

---

## 1. Security Architecture Principles

1. **Database as the Absolute Boundary:** Because function adapters and API routes execute in serverless/browser environments, all security checks are anchored directly in PostgreSQL RLS policies. Client tampering cannot bypass RLS.
2. **Authenticated Context via `auth.uid()`:** Supabase populates `auth.uid()` from verified JWT signatures. Every policy extracts user identity solely via `auth.uid()`.
3. **Roles Derived from Database:** Roles are read from `public.user_roles` via `public.has_role(auth.uid(), '...')`, never from client JWT user_metadata which could be forged or stale.
4. **Strict Team Scoping for Managers:** Managers are permitted to read/evaluate only:
   - Direct reports: `profiles.manager_id = auth.uid()`
   - Department subordinates: `profiles.department_id IN (SELECT id FROM departments WHERE responsible_person_id = auth.uid())`
5. **State-Locked Updates:** Attendance punches, signed contracts, and approved evaluations become immutable. Managers can only update evaluations when `status IN ('draft', 'returned')`.

---

## 2. Core Database Helper Functions

```sql
-- 1. Check if user holds a specified role
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, target_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = $1 AND role = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fast check for Admin or HR
CREATE OR REPLACE FUNCTION public.is_admin_or_hr(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = $1 AND role IN ('admin', 'hr')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Check if user is a direct manager or department head of an employee
CREATE OR REPLACE FUNCTION public.is_manager_of(emp_id uuid, mgr_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = emp_id
      AND (
        p.manager_id = mgr_id
        OR p.department_id IN (
          SELECT d.id FROM public.departments d
          WHERE d.responsible_person_id = mgr_id
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Exhaustive Table-by-Table RLS Policies

### 3.1 Identity & Organization

#### Table: `public.profiles`
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.profiles TO authenticated, service_role;

-- Admin & HR: Unrestricted Read/Write
CREATE POLICY "profiles_admin_hr_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- Self: Read own profile
CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Managers: Read scoped team members
CREATE POLICY "profiles_manager_team_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND public.is_manager_of(id, auth.uid())
  );
```

#### Table: `public.user_roles`
```sql
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_roles TO authenticated, service_role;

-- Admin: Full management of user roles
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated: Read own assigned roles
CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

#### Table: `public.departments`, `public.positions`, `public.job_grades`, `public.cost_centers`
```sql
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- Read Access: All authenticated employees can view organizational structures
CREATE POLICY "org_read_all" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "positions_read_all" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "grades_read_all" ON public.job_grades FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_centers_read_all" ON public.cost_centers FOR SELECT TO authenticated USING (true);

-- Write Access: Only Admin and HR can create or modify organizational nodes
CREATE POLICY "org_write_admin" ON public.departments FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "positions_write_admin" ON public.positions FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "grades_write_admin" ON public.job_grades FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "cost_centers_write_admin" ON public.cost_centers FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
```

---

### 3.2 Attendance & Geofencing

#### Table: `public.attendance_logs`
```sql
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.attendance_logs TO authenticated, service_role;

-- Admin & HR: Unrestricted access
CREATE POLICY "att_logs_admin_hr_all" ON public.attendance_logs
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- Employee: Read own attendance history
CREATE POLICY "att_logs_self_read" ON public.attendance_logs
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- Employee: Submit own attendance punches
CREATE POLICY "att_logs_self_insert" ON public.attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Manager: Read attendance for direct team members
CREATE POLICY "att_logs_manager_read" ON public.attendance_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND public.is_manager_of(employee_id, auth.uid())
  );
```

#### Table: `public.geofence_locations` & `public.shifts`
```sql
ALTER TABLE public.geofence_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Read: Authenticated staff can read geofences to verify punch coordinates
CREATE POLICY "geofence_read_all" ON public.geofence_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "shifts_read_all" ON public.shifts FOR SELECT TO authenticated USING (true);

-- Write: Restricted to Admin and HR
CREATE POLICY "geofence_write_admin" ON public.geofence_locations FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "shifts_write_admin" ON public.shifts FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
```

---

### 3.3 Leaves & Vacations

#### Table: `public.leave_requests`
```sql
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.leave_requests TO authenticated, service_role;

-- Admin & HR: All permissions
CREATE POLICY "leaves_admin_hr_all" ON public.leave_requests
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- Employee: Read own leave requests
CREATE POLICY "leaves_self_read" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- Employee: Submit new leave request for self
CREATE POLICY "leaves_self_insert" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Manager: Read team leave requests
CREATE POLICY "leaves_manager_read" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND public.is_manager_of(employee_id, auth.uid())
  );

-- Manager: Approve/Reject team leave requests
CREATE POLICY "leaves_manager_update" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND public.is_manager_of(employee_id, auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND public.is_manager_of(employee_id, auth.uid())
  );
```

---

### 3.4 Payroll & Solaf (Advances)

#### Table: `public.advances`
```sql
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.advances TO authenticated, service_role;

-- Admin & Finance: Full access
CREATE POLICY "advances_admin_finance_all" ON public.advances
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

-- Employee: View own advance history
CREATE POLICY "advances_self_read" ON public.advances
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- Employee: Submit new advance request
CREATE POLICY "advances_self_insert" ON public.advances
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() AND status = 'pending');

-- Manager: View team advance requests
CREATE POLICY "advances_manager_read" ON public.advances
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND public.is_manager_of(employee_id, auth.uid())
  );
```

---

### 3.5 KPI & Performance Evaluation (Quarterly & 3-Layer)

#### Table: `public.kpi_criteria` & `public.kpi_templates`
```sql
ALTER TABLE public.kpi_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_template_items ENABLE ROW LEVEL SECURITY;

-- Read: Open catalog viewable by all staff to understand target expectations
CREATE POLICY "kpi_criteria_read" ON public.kpi_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi_templates_read" ON public.kpi_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi_template_items_read" ON public.kpi_template_items FOR SELECT TO authenticated USING (true);

-- Write: Restricted to Admin & HR
CREATE POLICY "kpi_criteria_admin_write" ON public.kpi_criteria FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "kpi_templates_admin_write" ON public.kpi_templates FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "kpi_template_items_admin_write" ON public.kpi_template_items FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid())) WITH CHECK (public.is_admin_or_hr(auth.uid()));
```

#### Table: `public.kpi_quarterly_evaluations`
```sql
ALTER TABLE public.kpi_quarterly_evaluations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.kpi_quarterly_evaluations TO authenticated, service_role;

-- 1. Admin & HR: Unrestricted Review, Approval, and Return access
CREATE POLICY "kpi_q_admin_all" ON public.kpi_quarterly_evaluations
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- 2. Manager Read: Scoped to evaluations they created or evaluations for their team
CREATE POLICY "kpi_q_manager_read" ON public.kpi_quarterly_evaluations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND (evaluator_id = auth.uid() OR public.is_manager_of(employee_id, auth.uid()))
  );

-- 3. Manager Insert: Create evaluation for team members
CREATE POLICY "kpi_q_manager_insert" ON public.kpi_quarterly_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND evaluator_id = auth.uid()
    AND public.is_manager_of(employee_id, auth.uid())
  );

-- 4. Manager Update: Permitted ONLY when status is 'draft' or 'returned' (Locked when approved)
CREATE POLICY "kpi_q_manager_update" ON public.kpi_quarterly_evaluations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND evaluator_id = auth.uid()
    AND status IN ('draft', 'returned')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND evaluator_id = auth.uid()
  );

-- 5. Employee Self Read: Read own evaluation ONLY after submission or approval
CREATE POLICY "kpi_q_emp_read" ON public.kpi_quarterly_evaluations
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    AND status IN ('submitted', 'approved')
  );
```

#### Table: `public.kpi_evaluation_transitions`
```sql
ALTER TABLE public.kpi_evaluation_transitions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.kpi_evaluation_transitions TO authenticated, service_role;

-- Read: Admin/HR, author, or the evaluated employee
CREATE POLICY "kpi_transitions_read" ON public.kpi_evaluation_transitions
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_hr(auth.uid())
    OR actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kpi_quarterly_evaluations e
      WHERE e.id = evaluation_id AND (e.employee_id = auth.uid() OR e.evaluator_id = auth.uid())
    )
  );

-- Insert: Log transition with authentic actor ID
CREATE POLICY "kpi_transitions_insert" ON public.kpi_evaluation_transitions
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_admin_or_hr(auth.uid()));
```
