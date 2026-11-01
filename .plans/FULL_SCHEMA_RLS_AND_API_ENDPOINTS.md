# INT HR System — Full Database Schema, Row-Level Security (RLS) & API Endpoints Specification

> **System Version:** 2.6.0  
> **Target Environment:** Supabase PostgreSQL & TanStack Start Server Functions  
> **Timezone Standard:** Africa/Cairo (`UTC+02:00` / `UTC+03:00`)  
> **Authorization Model:** Strict Server-Side RLS with Authenticated Context & Multi-Tier Role Evaluation  
> **Last Updated:** November 2026

---

## Table of Contents
1. [Architectural Overview & Security Model](#1-architectural-overview--security-model)
2. [Complete Database Schema Data Dictionary](#2-complete-database-schema-data-dictionary)
   - [2.1 Identity, Profiles & Organization](#21-identity-profiles--organization)
   - [2.2 Time Management, Shifts & Attendance](#22-time-management-shifts--attendance)
   - [2.3 Biometrics, Face Verification & Anti-Spoofing](#23-biometrics-face-verification--anti-spoofing)
   - [2.4 Leaves, Holidays & Working Days](#24-leaves-holidays--working-days)
   - [2.5 Payroll, Solaf (Advances), Allowances & Penalties](#25-payroll-solaf-advances-allowances--penalties)
   - [2.6 KPI & Performance Evaluation (Quarterly & 3-Layer)](#26-kpi--performance-evaluation-quarterly--3-layer)
   - [2.7 Contracts, Tasks, Custody & Audit Logs](#27-contracts-tasks-custody--audit-logs)
3. [Exhaustive Row-Level Security (RLS) Policies](#3-exhaustive-row-level-security-rls-policies)
4. [Complete Backend API Endpoints & Server Functions](#4-complete-backend-api-endpoints--server-functions)
   - [4.1 Authentication & Profile APIs](#41-authentication--profile-apis)
   - [4.2 Employee & Organizational Hierarchy APIs](#42-employee--organizational-hierarchy-apis)
   - [4.3 Attendance, Geofencing & Biometric Security APIs](#43-attendance-geofencing--biometric-security-apis)
   - [4.4 Leaves, Vacations & Holiday APIs](#44-leaves-vacations--holiday-apis)
   - [4.5 Payroll, Solaf (Advances) & Allowance APIs](#45-payroll-solaf-advances--allowance-apis)
   - [4.6 KPI & Performance Evaluation APIs](#46-kpi--performance-evaluation-apis)
   - [4.7 Contracts, Custody & Task APIs](#47-contracts-custody--task-apis)
   - [4.8 System Settings, Security & Audit APIs](#48-system-settings-security--audit-apis)

---

## 1. Architectural Overview & Security Model

### 1.1 Identity Boundary & Role Mapping
The application couples Supabase Auth (`auth.users`) with application-level profiles (`public.profiles`) and a dedicated role membership table (`public.user_roles`).
- **Core Principle:** In all browser-executed code and TanStack Start server functions, role context is verified against the database table `public.user_roles` using the authenticated `auth.uid()`, never relying on client-stored claims or local storage.
- **Roles:**
  - `admin`: Complete system administration across all modules, settings, payroll, and security policies.
  - `hr`: Human Resources administration, contract management, leave audits, attendance approvals, and KPI oversight.
  - `manager`: Team supervision scoped strictly to direct reports (`manager_id = auth.uid()`) or department subordinates (`departments.responsible_person_id = auth.uid()`).
  - `finance`: Payroll verification, salary disbursement, advance deductions, and allowance approvals.
  - `employee`: Self-service portal (personal check-in, attendance logs, leave submissions, advance requests, personal KPI scorecard).

### 1.2 Helper Functions in Database
```sql
-- Verify if a given user holds a specific role
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, target_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = $1 AND role = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quick check for administrative privilege
CREATE OR REPLACE FUNCTION public.is_admin_or_hr(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = $1 AND role IN ('admin', 'hr')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 2. Complete Database Schema Data Dictionary

### 2.1 Identity, Profiles & Organization

#### `public.profiles`
Central employee master record linked 1-to-1 with Supabase Auth.
- `id` (`uuid`, PK, references `auth.users.id` ON DELETE CASCADE)
- `emp_code` (`text`, UNIQUE, NOT NULL): Official INT employee code (e.g. `INT-1016`).
- `full_name` (`text`, NOT NULL): English full name.
- `full_name_ar` (`text`): Arabic legal full name.
- `email` (`text`, NOT NULL)
- `phone` (`text`)
- `national_id` (`text`): Egyptian National ID number.
- `department_id` (`uuid`, FK -> `departments.id` ON DELETE SET NULL)
- `position_id` (`uuid`, FK -> `positions.id` ON DELETE SET NULL)
- `job_grade_id` (`uuid`, FK -> `job_grades.id` ON DELETE SET NULL)
- `cost_center_id` (`uuid`, FK -> `cost_centers.id` ON DELETE SET NULL)
- `section_id` (`uuid`, FK -> `sections.id` ON DELETE SET NULL)
- `sub_section_id` (`uuid`, FK -> `sub_sections.id` ON DELETE SET NULL)
- `manager_id` (`uuid`, FK -> `profiles.id` ON DELETE SET NULL): Direct reporting line.
- `shift_id` (`uuid`, FK -> `shifts.id` ON DELETE SET NULL): Assigned primary work shift.
- `salary_mode` (`text`, DEFAULT 'monthly' CHECK `in ('monthly', 'daily', 'hourly')`)
- `salary_amount` (`numeric`, DEFAULT 0.0)
- `bank_name` (`text`)
- `bank_account_number` (`text`)
- `iban` (`text`)
- `insurance_number` (`text`)
- `insurance_status` (`text`, DEFAULT 'not_insured' CHECK `in ('insured', 'not_insured')`)
- `medical_insurance_tier` (`text`)
- `medical_insurance_card_number` (`text`)
- `annual_advance_limit` (`numeric`, DEFAULT 0.0): Maximum annual advance allowance.
- `status` (`text`, DEFAULT 'active' CHECK `in ('active', 'suspended', 'terminated', 'on_leave')`)
- `hire_date` (`date`, NOT NULL)
- `birth_date` (`date`)
- `avatar_url` (`text`)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)
- `updated_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

#### `public.user_roles`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `user_id` (`uuid`, NOT NULL, FK -> `profiles.id` ON DELETE CASCADE)
- `role` (`text`, NOT NULL CHECK `in ('admin', 'hr', 'manager', 'employee', 'finance')`)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)
- *Constraint:* `UNIQUE(user_id, role)`

#### `public.departments`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `code` (`text`, NOT NULL)
- `name_en` (`text`, NOT NULL)
- `name_ar` (`text`, NOT NULL)
- `responsible_person_id` (`uuid`, FK -> `profiles.id` ON DELETE SET NULL): Department Head.
- `active` (`boolean`, DEFAULT true)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

#### `public.positions`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `code` (`text`)
- `name_en` (`text`, NOT NULL)
- `name_ar` (`text`, NOT NULL)
- `department_id` (`uuid`, FK -> `departments.id` ON DELETE SET NULL)
- `active` (`boolean`, DEFAULT true)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

#### `public.job_grades`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `code` (`text`, NOT NULL)
- `name_en` (`text`, NOT NULL)
- `name_ar` (`text`, NOT NULL)
- `min_salary` (`numeric`, DEFAULT 0.0)
- `max_salary` (`numeric`, DEFAULT 0.0)
- `active` (`boolean`, DEFAULT true)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

#### `public.cost_centers`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `code` (`text`, UNIQUE, NOT NULL)
- `name_en` (`text`, NOT NULL)
- `name_ar` (`text`, NOT NULL)
- `budget` (`numeric`, DEFAULT 0.0)
- `active` (`boolean`, DEFAULT true)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

---

### 2.2 Time Management, Shifts & Attendance

#### `public.attendance_logs`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `employee_id` (`uuid`, NOT NULL, FK -> `profiles.id` ON DELETE CASCADE)
- `timestamp` (`timestamptz`, NOT NULL): Punch timestamp (Africa/Cairo).
- `type` (`text`, NOT NULL CHECK `in ('check_in', 'check_out')`)
- `verification_method` (`text`, NOT NULL CHECK `in ('face', 'gps', 'network', 'manual_override', 'terminal')`)
- `geofence_id` (`uuid`, FK -> `geofence_locations.id` ON DELETE SET NULL)
- `network_id` (`uuid`, FK -> `company_networks.id` ON DELETE SET NULL)
- `device_id` (`text`)
- `latitude` (`numeric(10, 7)`)
- `longitude` (`numeric(10, 7)`)
- `accuracy_meters` (`numeric`)
- `is_within_geofence` (`boolean`, DEFAULT false)
- `is_anti_spoofing_verified` (`boolean`, DEFAULT false)
- `status` (`text`, DEFAULT 'valid' CHECK `in ('valid', 'flagged', 'rejected', 'override')`)
- `notes` (`text`)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

#### `public.shifts`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `name_en` (`text`, NOT NULL)
- `name_ar` (`text`, NOT NULL)
- `start_time` (`time`, NOT NULL): e.g. `08:30:00`
- `end_time` (`time`, NOT NULL): e.g. `17:00:00`
- `grace_period_minutes` (`integer`, DEFAULT 15)
- `is_overnight` (`boolean`, DEFAULT false)
- `active` (`boolean`, DEFAULT true)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

#### `public.geofence_locations`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `name_en` (`text`, NOT NULL)
- `name_ar` (`text`, NOT NULL)
- `latitude` (`numeric(10, 7)`, NOT NULL)
- `longitude` (`numeric(10, 7)`, NOT NULL)
- `radius_meters` (`numeric`, NOT NULL DEFAULT 100.0)
- `is_active` (`boolean`, DEFAULT true)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

---

### 2.3 Biometrics, Face Verification & Anti-Spoofing

#### `public.biometric_verification_tokens`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `employee_id` (`uuid`, NOT NULL, FK -> `profiles.id` ON DELETE CASCADE)
- `token` (`text`, UNIQUE, NOT NULL): Single-use cryptographic challenge token.
- `nonce` (`text`, NOT NULL): Client device hardware/session entropy.
- `liveness_challenge` (`jsonb`, NOT NULL): Required gesture sequence (e.g. `blink`, `nod`).
- `expires_at` (`timestamptz`, NOT NULL): 120-second validity window.
- `is_consumed` (`boolean`, DEFAULT false)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

#### `public.security_settings`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `require_biometrics` (`boolean`, DEFAULT true)
- `require_geofencing` (`boolean`, DEFAULT true)
- `block_mock_locations` (`boolean`, DEFAULT true)
- `face_match_threshold` (`numeric`, DEFAULT 0.85)
- `max_failed_attempts` (`integer`, DEFAULT 3)
- `lockout_duration_minutes` (`integer`, DEFAULT 15)
- `anti_tamper_salt` (`text`)
- `updated_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

---

### 2.4 Leaves, Holidays & Working Days

#### `public.leave_types`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `code` (`text`, UNIQUE, NOT NULL): e.g. `annual`, `sick`, `casual`, `unpaid`, `maternity`.
- `name_en` (`text`, NOT NULL)
- `name_ar` (`text`, NOT NULL)
- `default_days_per_year` (`numeric`, DEFAULT 21.0)
- `requires_attachment` (`boolean`, DEFAULT false)
- `is_paid` (`boolean`, DEFAULT true)
- `active` (`boolean`, DEFAULT true)

#### `public.leave_balances`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `employee_id` (`uuid`, NOT NULL, FK -> `profiles.id` ON DELETE CASCADE)
- `leave_type_id` (`uuid`, NOT NULL, FK -> `leave_types.id` ON DELETE CASCADE)
- `year` (`integer`, NOT NULL)
- `allocated_days` (`numeric`, NOT NULL DEFAULT 21.0)
- `used_days` (`numeric`, NOT NULL DEFAULT 0.0)
- `pending_days` (`numeric`, NOT NULL DEFAULT 0.0)
- *Constraint:* `UNIQUE(employee_id, leave_type_id, year)`

#### `public.leave_requests`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `employee_id` (`uuid`, NOT NULL, FK -> `profiles.id` ON DELETE CASCADE)
- `leave_type_id` (`uuid`, NOT NULL, FK -> `leave_types.id` ON DELETE RESTRICT)
- `start_date` (`date`, NOT NULL)
- `end_date` (`date`, NOT NULL)
- `days_count` (`numeric`, NOT NULL)
- `reason` (`text`, NOT NULL)
- `attachment_url` (`text`)
- `status` (`text`, DEFAULT 'pending' CHECK `in ('pending', 'approved_by_manager', 'approved', 'rejected', 'cancelled')`)
- `manager_action_by` (`uuid`, FK -> `profiles.id`)
- `manager_action_at` (`timestamptz`)
- `hr_action_by` (`uuid`, FK -> `profiles.id`)
- `hr_action_at` (`timestamptz`)
- `rejection_reason` (`text`)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

---

### 2.5 Payroll, Solaf (Advances), Allowances & Penalties

#### `public.advances` (Loans / Solaf)
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `employee_id` (`uuid`, NOT NULL, FK -> `profiles.id` ON DELETE CASCADE)
- `amount` (`numeric`, NOT NULL CHECK (amount > 0))
- `repayment_months` (`integer`, NOT NULL DEFAULT 1 CHECK (repayment_months >= 1 AND repayment_months <= 24))
- `deduction_start_date` (`date`, NOT NULL)
- `monthly_installment` (`numeric`, NOT NULL)
- `remaining_balance` (`numeric`, NOT NULL)
- `reason` (`text`, NOT NULL)
- `status` (`text`, DEFAULT 'pending' CHECK `in ('pending', 'approved', 'rejected', 'in_progress', 'completed')`)
- `approved_by` (`uuid`, FK -> `profiles.id`)
- `approved_at` (`timestamptz`)
- `rejection_reason` (`text`)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

#### `public.advance_installments`
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `advance_id` (`uuid`, NOT NULL, FK -> `advances.id` ON DELETE CASCADE)
- `installment_number` (`integer`, NOT NULL)
- `due_date` (`date`, NOT NULL)
- `amount` (`numeric`, NOT NULL)
- `is_deducted` (`boolean`, DEFAULT false)
- `payroll_item_id` (`uuid`)
- `deducted_at` (`timestamptz`)

#### `public.trips` & `public.applied_trip_allowances`
- `trips`: Employee business excursions with start time, destination coordinates, and distance.
- `applied_trip_allowances`: Financial allowance attached to the employee based on distance slab rates.

---

### 2.6 KPI & Performance Evaluation (Quarterly & 3-Layer)

#### `public.kpi_criteria` (The Criteria Catalog)
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `code` (`text`, UNIQUE): e.g. `KPI-101`.
- `name_en` (`text`, NOT NULL)
- `name_ar` (`text`, NOT NULL)
- `description_en` (`text`)
- `description_ar` (`text`)
- `criterion_type` (`text`, NOT NULL CHECK `in ('common', 'position_specific', 'custom')`)
- `category` (`text`, NOT NULL DEFAULT 'technical' CHECK `in ('behavioral', 'technical', 'quality', 'productivity', 'safety', 'coordination')`)
- `scoring_scale` (`text`, NOT NULL DEFAULT 'percentage' CHECK `in ('rating_5', 'percentage', 'count', 'boolean')`)
- `max_scale_value` (`numeric`, DEFAULT 100)
- `default_weight` (`numeric`, NOT NULL CHECK (default_weight > 0 AND default_weight <= 1.0))
- `default_target` (`numeric`, NOT NULL DEFAULT 1.0)
- `unit` (`text`, DEFAULT '%')
- `how_measured_en` (`text`)
- `how_measured_ar` (`text`)
- `is_required` (`boolean`, DEFAULT true)
- `is_active` (`boolean`, DEFAULT true)
- `display_order` (`integer`, DEFAULT 0)

#### `public.kpi_templates` & `public.kpi_template_items`
- Maps criteria to specific positions (e.g. Junior ELV Site Engineer) and enforces:
  $$\sum \text{weights} = 100\% \quad (\text{Common } 40\% + \text{Position } 60\%)$$

#### `public.kpi_quarterly_evaluations`
Independent headers for quarterly reviews.
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `employee_id` (`uuid`, NOT NULL, FK -> `profiles.id` ON DELETE CASCADE)
- `evaluator_id` (`uuid`, NOT NULL, FK -> `profiles.id` ON DELETE RESTRICT)
- `evaluation_year` (`integer`, NOT NULL CHECK (evaluation_year >= 2020 AND evaluation_year <= 2100))
- `quarter` (`text`, NOT NULL CHECK `in ('q1', 'q2', 'q3', 'q4')`)
- `template_id` (`uuid`, FK -> `kpi_templates.id`)
- `status` (`text`, NOT NULL DEFAULT 'draft' CHECK `in ('draft', 'submitted', 'returned', 'approved')`)
- `score` (`numeric`, NOT NULL DEFAULT 0.0 CHECK (score >= 0.0 AND score <= 100.0))
- `common_score` (`numeric`, DEFAULT 0.0)
- `position_score` (`numeric`, DEFAULT 0.0)
- `rating_tier` (`text`, DEFAULT 'Pending Evaluation')
- `return_reason` (`text`): Mandatory return notes when rejected back to manager.
- `notes` (`jsonb`, NOT NULL DEFAULT `'{"strengths":"","growthAreas":"","recommendations":""}'::jsonb`)
- `submitted_at` (`timestamptz`)
- `returned_at` (`timestamptz`)
- `approved_at` (`timestamptz`)
- *Constraint:* `UNIQUE(employee_id, evaluation_year, quarter)`

#### `public.kpi_quarterly_items`
Frozen snapshot line items calculated upon evaluation.
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `evaluation_id` (`uuid`, NOT NULL, FK -> `kpi_quarterly_evaluations.id` ON DELETE CASCADE)
- `criterion_id` (`uuid`, FK -> `kpi_criteria.id`)
- `criterion_name_en` (`text`, NOT NULL)
- `criterion_name_ar` (`text`, NOT NULL)
- `criterion_type` (`text`, NOT NULL)
- `category` (`text`, NOT NULL)
- `weight` (`numeric`, NOT NULL)
- `target_benchmark` (`numeric`, NOT NULL)
- `actual_value` (`numeric`)
- `achievement_rate` (`numeric`)
- `weighted_score` (`numeric`)
- `comments` (`text`)

#### `public.kpi_evaluation_transitions`
Immutable audit history for all evaluation state changes.
- `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
- `evaluation_id` (`uuid`, NOT NULL, FK -> `kpi_quarterly_evaluations.id` ON DELETE CASCADE)
- `actor_id` (`uuid`, NOT NULL, FK -> `profiles.id`)
- `actor_name` (`text`)
- `from_status` (`text`, NOT NULL)
- `to_status` (`text`, NOT NULL)
- `reason` (`text`): Captured mandatory revision reason.
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

---

## 3. Exhaustive Row-Level Security (RLS) Policies

All tables below strictly enforce `ENABLE ROW LEVEL SECURITY`.

| Table | Policy Name | Command | Allowed Roles / Target | `USING` & `WITH CHECK` Expression |
|---|---|---|---|---|
| **profiles** | `profiles_admin_hr_all` | ALL | `admin`, `hr` | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')` |
| **profiles** | `profiles_self_read` | SELECT | Authenticated | `id = auth.uid()` |
| **profiles** | `profiles_manager_team_read` | SELECT | `manager` | `manager_id = auth.uid() OR department_id IN (SELECT id FROM departments WHERE responsible_person_id = auth.uid())` |
| **user_roles** | `user_roles_admin_manage` | ALL | `admin` | `public.has_role(auth.uid(), 'admin')` |
| **user_roles** | `user_roles_self_read` | SELECT | Authenticated | `user_id = auth.uid()` |
| **attendance_logs** | `att_admin_hr_all` | ALL | `admin`, `hr` | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')` |
| **attendance_logs** | `att_self_read_insert` | SELECT, INSERT | Authenticated | `employee_id = auth.uid()` |
| **attendance_logs** | `att_manager_read` | SELECT | `manager` | `employee_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())` |
| **leave_requests** | `leaves_admin_hr_all` | ALL | `admin`, `hr` | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')` |
| **leave_requests** | `leaves_self_select_insert` | SELECT, INSERT | Authenticated | `employee_id = auth.uid()` |
| **leave_requests** | `leaves_manager_manage` | SELECT, UPDATE | `manager` | `employee_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())` |
| **advances** | `advances_admin_finance_all`| ALL | `admin`, `finance` | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance')` |
| **advances** | `advances_self_select_insert`| SELECT, INSERT| Authenticated | `employee_id = auth.uid()` |
| **advances** | `advances_manager_read` | SELECT | `manager` | `employee_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())` |
| **kpi_criteria** | `kpi_criteria_read` | SELECT | Authenticated | `true` (Public catalog for staff) |
| **kpi_criteria** | `kpi_criteria_write` | ALL | `admin`, `hr` | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')` |
| **kpi_quarterly_evaluations** | `kpi_q_admin_all` | ALL | `admin`, `hr` | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')` |
| **kpi_quarterly_evaluations** | `kpi_q_manager_read` | SELECT | `manager` | `evaluator_id = auth.uid() OR employee_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())` |
| **kpi_quarterly_evaluations** | `kpi_q_manager_write` | INSERT, UPDATE | `manager` | `evaluator_id = auth.uid() AND status IN ('draft', 'returned')` |
| **kpi_quarterly_evaluations** | `kpi_q_emp_read` | SELECT | Authenticated | `employee_id = auth.uid() AND status IN ('submitted', 'approved')` |

---

## 4. Complete Backend API Endpoints & Server Functions

All endpoints are built as type-safe TanStack Start server functions (`createServerFn`) enforcing session extraction and input validation via Zod schemas.

### 4.1 Authentication & Profile APIs
- **`getMe`** (`POST /api/auth/me`): Retrieves current user session, profile, and active roles.
  - *Auth:* Any authenticated user.
  - *Returns:* `{ id, email, full_name, roles: string[], employeeId }`
- **`getMyProfileDetails`** (`GET /api/auth/profile-details`): Returns complete profile with department, position (EN/AR), manager, and allowances.
  - *Auth:* Self (`auth.uid()`).
- **`changeAccountPassword`** (`POST /api/auth/change-password`): Changes password for another account via the isolated `send-smtp-email` service after administrative validation.
  - *Auth:* `admin` role required.

### 4.2 Employee & Organizational Hierarchy APIs
- **`listEmployeesAdmin`** (`POST /api/employees/list-admin`): Paginated directory with department, position, and status filtering.
  - *Input:* `{ page: number, pageSize: number, search?: string, departmentId?: string, status?: string }`
  - *Auth:* `admin`, `hr`.
- **`saveEmployee`** (`POST /api/employees/save`): Creates or updates employee profile record and syncs metadata.
  - *Auth:* `admin`, `hr`.
- **`getMyTeam`** (`POST /api/team/my-team`): Retrieves direct reports for the authenticated manager.
  - *Auth:* `manager`, `admin`.

### 4.3 Attendance, Geofencing & Biometric Security APIs
- **`checkInAttendance`** (`POST /api/attendance/check-in`):
  - *Input:* `{ latitude: number, longitude: number, accuracy: number, verificationToken: string, selfieBase64?: string }`
  - *Validations:* Distance calculation against active geofence, device anti-tamper check, liveness challenge consumption.
  - *Side Effect:* Records punch into `attendance_logs`.
- **`checkOutAttendance`** (`POST /api/attendance/check-out`): Similar verification pipeline for end-of-shift logging.
- **`listAttendanceLogsAdmin`** (`POST /api/attendance/logs-admin`): Paginated RLS-scoped reads of all punch activities.
- **`createBiometricChallenge`** (`POST /api/biometrics/challenge`): Generates short-lived verification token (120s) with cryptographic gestures.

### 4.4 Leaves, Vacations & Holiday APIs
- **`submitLeaveRequest`** (`POST /api/leaves/submit`):
  - *Input:* `{ leaveTypeId: string, startDate: string, endDate: string, reason: string, attachmentUrl?: string }`
  - *Validation:* Checks balance in `leave_balances` and verifies absence overlap.
- **`reviewLeaveRequest`** (`POST /api/leaves/review`):
  - *Input:* `{ requestId: string, action: 'approve' | 'reject', rejectionReason?: string }`
  - *Auth:* Supervisor (`manager`) or `hr` admin.

### 4.5 Payroll, Solaf (Advances) & Allowance APIs
- **`applyAdvance`** (`POST /api/advances/apply`):
  - *Input:* `{ amount: number, repaymentMonths: number, deductionStartDate: string, reason: string }`
  - *Validation:* Verifies `amount <= annual_advance_limit`.
- **`approveAdvance`** (`POST /api/advances/approve`):
  - *Input:* `{ advanceId: string }`
  - *Side Effect:* Automatically splits loan into scheduled entries in `advance_installments`.
  - *Auth:* `finance`, `admin`.
- **`runMonthlyPayroll`** (`POST /api/payroll/run`):
  - *Input:* `{ month: number, year: number, departmentId?: string }`
  - *Calculation:* Base salary + fixed allowances + trip allowances - loan installments - late penalties - unpaid leaves.

### 4.6 KPI & Performance Evaluation APIs
- **`listKpiCriteria`** (`POST /api/kpi/criteria/list`): Lists all active criteria filtered by layer (`common`, `role`, `custom`).
- **`saveKpiCriterion`** (`POST /api/kpi/criteria/save`):
  - *Input:* `{ id?: string, code: string, name_en: string, name_ar: string, category_en: string, category_ar: string, layer: 'common' | 'role' | 'custom', default_weight: number, default_target: number, unit: string, how_measured_en?: string, how_measured_ar?: string }`
  - *Auth:* `admin`, `hr`.
- **`getQuarterlyEvaluation`** (`POST /api/kpi/quarterly/get`):
  - *Input:* `{ employeeId: string, year: number, quarter: 'q1' | 'q2' | 'q3' | 'q4' }`
- **`saveQuarterlyEvaluation`** (`POST /api/kpi/quarterly/save`):
  - *Input:* `{ employeeId: string, year: number, quarter: 'q1'|'q2'|'q3'|'q4', items: Array<{ criterionId: string, actualValue: number, comments?: string }>, notes: { strengths: string, growthAreas: string, recommendations: string }, submitToHr?: boolean }`
  - *Server Enforcement:* Recalculates all line items:
    $$\text{achievement} = \min(1.0, \text{actual} / \text{target}), \quad \text{score} = \sum (\text{achievement} \times \text{weight} \times 100)$$
- **`reviewQuarterlyEvaluation`** (`POST /api/kpi/quarterly/review`):
  - *Input:* `{ evaluation_id: string, action: 'approve' | 'return', return_reason?: string }`
  - *Rule:* If `action === 'return'`, `return_reason` is **strictly required** ($ge 5$ characters).
  - *Auth:* `hr`, `admin`.
- **`listPendingApprovals`** (`POST /api/kpi/approvals/pending`): Returns queue of submitted quarterly evaluations waiting for HR review.

### 4.7 Contracts, Custody & Task APIs
- **`listContracts`** & **`getContractNotifications`**: Real-time alerts for contracts expiring within 60 days.
- **`assignTask`** & **`updateTaskStatus`**: Field engineering task dispatch and completion reporting.

### 4.8 System Settings, Security & Audit APIs
- **`getSecuritySettings`** & **`updateSecuritySettings`**: Configures face thresholds, mock location detection, and lockout intervals.
- **`getAuditLogs`**: Immutable audit stream with actor, IP, timestamp, target entity, and change diffs.
