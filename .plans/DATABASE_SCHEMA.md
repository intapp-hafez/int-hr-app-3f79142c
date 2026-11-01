# INT HR System — Complete Database Schema & Data Dictionary

> **System Version:** 2.6.0  
> **Database Engine:** PostgreSQL 15+ (Supabase)  
> **Timezone Standard:** Africa/Cairo (`UTC+02:00` / `UTC+03:00`)  
> **Generated:** November 2026

---

## 1. Domain Overview
The INT HR database consists of 36 relational tables categorized into 7 functional domains:
1. [Identity, Profiles & Organizational Hierarchy](#2-identity-profiles--organizational-hierarchy)
2. [Time Management, Shifts & Attendance](#3-time-management-shifts--attendance)
3. [Biometrics, Face Verification & Anti-Spoofing](#4-biometrics-face-verification--anti-spoofing)
4. [Leaves, Vacations & Working Days](#5-leaves-vacations--working-days)
5. [Payroll, Solaf (Advances), Allowances & Penalties](#6-payroll-solaf-advances-allowances--penalties)
6. [KPI & Performance Evaluations (Quarterly & 3-Layer)](#7-kpi--performance-evaluations-quarterly--3-layer)
7. [Contracts, Tasks, Custody, Chat & Communications](#8-contracts-tasks-custody-chat--communications)

---

## 2. Identity, Profiles & Organizational Hierarchy

### 2.1 `public.profiles`
Central employee master profile linked 1-to-1 with Supabase Auth (`auth.users`).

| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | - | PK, FK -> `auth.users(id)` ON DELETE CASCADE | Matches Supabase Auth user ID. |
| `emp_code` | `text` | NO | - | UNIQUE | Official employee code (e.g. `INT-1016`). |
| `full_name` | `text` | NO | - | - | Employee full name in English. |
| `full_name_ar` | `text` | YES | NULL | - | Legal employee full name in Arabic. |
| `email` | `text` | NO | - | - | Official email address. |
| `phone` | `text` | YES | NULL | - | Mobile contact number. |
| `national_id` | `text` | YES | NULL | - | 14-digit Egyptian National ID. |
| `department_id` | `uuid` | YES | NULL | FK -> `departments(id)` ON DELETE SET NULL | Assigned department. |
| `position_id` | `uuid` | YES | NULL | FK -> `positions(id)` ON DELETE SET NULL | Assigned job position. |
| `job_grade_id` | `uuid` | YES | NULL | FK -> `job_grades(id)` ON DELETE SET NULL | Assigned job grade/scale. |
| `cost_center_id` | `uuid` | YES | NULL | FK -> `cost_centers(id)` ON DELETE SET NULL | Assigned financial cost center. |
| `section_id` | `uuid` | YES | NULL | FK -> `sections(id)` ON DELETE SET NULL | Assigned department section. |
| `sub_section_id` | `uuid` | YES | NULL | FK -> `sub_sections(id)` ON DELETE SET NULL | Assigned operational sub-section. |
| `manager_id` | `uuid` | YES | NULL | FK -> `profiles(id)` ON DELETE SET NULL | Direct supervisor/line manager. |
| `shift_id` | `uuid` | YES | NULL | FK -> `shifts(id)` ON DELETE SET NULL | Primary attendance work shift. |
| `salary_mode` | `text` | YES | 'monthly' | CHECK (`salary_mode IN ('monthly', 'daily', 'hourly')`) | Salary calculation basis. |
| `salary_amount` | `numeric` | YES | 0.0 | CHECK (`salary_amount >= 0`) | Gross base salary amount. |
| `bank_name` | `text` | YES | NULL | - | Employee disbursement bank name. |
| `bank_account_number` | `text` | YES | NULL | - | Bank account number. |
| `iban` | `text` | YES | NULL | - | International Bank Account Number. |
| `insurance_number` | `text` | YES | NULL | - | Social insurance ID number. |
| `insurance_status` | `text` | YES | 'not_insured' | CHECK (`insurance_status IN ('insured', 'not_insured')`) | Insurance status. |
| `medical_insurance_tier` | `text` | YES | NULL | - | Medical insurance coverage tier. |
| `medical_insurance_card_number` | `text` | YES | NULL | - | Medical card identifier. |
| `annual_advance_limit` | `numeric` | YES | 0.0 | CHECK (`annual_advance_limit >= 0`) | Maximum annual advance/loan ceiling. |
| `status` | `text` | NO | 'active' | CHECK (`status IN ('active', 'suspended', 'terminated', 'on_leave')`) | Employment state. |
| `hire_date` | `date` | NO | - | - | Date employment commenced. |
| `birth_date` | `date` | YES | NULL | - | Employee date of birth. |
| `avatar_url` | `text` | YES | NULL | - | Storage path for profile avatar. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Row creation timestamp. |
| `updated_at` | `timestamptz`| NO | `clock_timestamp()` | - | Row modification timestamp. |

**Indexes:**
- `idx_profiles_emp_code` ON (`emp_code`)
- `idx_profiles_dept_pos` ON (`department_id`, `position_id`)
- `idx_profiles_manager` ON (`manager_id`)
- `idx_profiles_status` ON (`status`)

---

### 2.2 `public.user_roles`
Stores granular role assignments for authorization.

| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique role assignment ID. |
| `user_id` | `uuid` | NO | - | FK -> `profiles(id)` ON DELETE CASCADE | Associated employee. |
| `role` | `text` | NO | - | CHECK (`role IN ('admin', 'hr', 'manager', 'employee', 'finance')`) | Assigned role. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Assignment timestamp. |

**Constraints:** `UNIQUE (user_id, role)`

---

### 2.3 `public.departments`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Department UUID. |
| `code` | `text` | NO | - | - | Department code (e.g. `ENG-01`). |
| `name_en` | `text` | NO | - | - | English name. |
| `name_ar` | `text` | NO | - | - | Arabic name. |
| `responsible_person_id` | `uuid` | YES | NULL | FK -> `profiles(id)` ON DELETE SET NULL | Department manager/head. |
| `active` | `boolean` | NO | true | - | Active department flag. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Creation timestamp. |

---

### 2.4 `public.positions`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Position UUID. |
| `code` | `text` | YES | NULL | - | Position code. |
| `name_en` | `text` | NO | - | - | Job title in English. |
| `name_ar` | `text` | NO | - | - | Job title in Arabic. |
| `department_id` | `uuid` | YES | NULL | FK -> `departments(id)` ON DELETE SET NULL | Parent department. |
| `active` | `boolean` | NO | true | - | Active position flag. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Creation timestamp. |

---

### 2.5 `public.job_grades`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Grade UUID. |
| `code` | `text` | NO | - | - | Grade level code (e.g. `G-04`). |
| `name_en` | `text` | NO | - | - | Grade name (English). |
| `name_ar` | `text` | NO | - | - | Grade name (Arabic). |
| `min_salary` | `numeric` | NO | 0.0 | - | Scale salary minimum. |
| `max_salary` | `numeric` | NO | 0.0 | - | Scale salary maximum. |
| `active` | `boolean` | NO | true | - | Active status. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Creation timestamp. |

---

### 2.6 `public.cost_centers`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Cost Center UUID. |
| `code` | `text` | NO | - | UNIQUE | Financial cost code. |
| `name_en` | `text` | NO | - | - | English description. |
| `name_ar` | `text` | NO | - | - | Arabic description. |
| `budget` | `numeric` | NO | 0.0 | - | Allocated budget. |
| `active` | `boolean` | NO | true | - | Active status. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Creation timestamp. |

---

## 3. Time Management, Shifts & Attendance

### 3.1 `public.attendance_logs`
Core biometric and GPS punch recording table.

| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Punch record ID. |
| `employee_id` | `uuid` | NO | - | FK -> `profiles(id)` ON DELETE CASCADE | Associated employee. |
| `timestamp` | `timestamptz`| NO | - | - | Actual punch time (Cairo timezone). |
| `type` | `text` | NO | - | CHECK (`type IN ('check_in', 'check_out')`) | Punch action. |
| `verification_method` | `text` | NO | - | CHECK (`verification_method IN ('face', 'gps', 'network', 'manual_override', 'terminal')`) | Method of verification. |
| `geofence_id` | `uuid` | YES | NULL | FK -> `geofence_locations(id)` ON DELETE SET NULL | Matched geofence site. |
| `network_id` | `uuid` | YES | NULL | FK -> `company_networks(id)` ON DELETE SET NULL | Matched Wi-Fi/BSSID network. |
| `device_id` | `text` | YES | NULL | - | Hardware device fingerprint. |
| `latitude` | `numeric(10, 7)`| YES | NULL | - | GPS latitude coordinate. |
| `longitude` | `numeric(10, 7)`| YES | NULL | - | GPS longitude coordinate. |
| `accuracy_meters` | `numeric` | YES | NULL | - | GPS horizontal accuracy radius. |
| `is_within_geofence` | `boolean`| NO | false | - | Geofence verification outcome. |
| `is_anti_spoofing_verified` | `boolean`| NO | false | - | Liveness & mock-GPS validation. |
| `status` | `text` | NO | 'valid' | CHECK (`status IN ('valid', 'flagged', 'rejected', 'override')`) | Attendance audit state. |
| `notes` | `text` | YES | NULL | - | Supervisor or system audit notes. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Server ingestion timestamp. |

**Indexes:**
- `idx_att_logs_emp_time` ON (`employee_id`, `timestamp`)
- `idx_att_logs_status` ON (`status`)

---

### 3.2 `public.shifts`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Shift UUID. |
| `name_en` | `text` | NO | - | - | Shift name (English). |
| `name_ar` | `text` | NO | - | - | Shift name (Arabic). |
| `start_time` | `time` | NO | - | - | Official start time (e.g. `08:30:00`). |
| `end_time` | `time` | NO | - | - | Official end time (e.g. `17:00:00`). |
| `grace_period_minutes` | `integer` | NO | 15 | - | Allowable late buffer minutes. |
| `is_overnight` | `boolean` | NO | false | - | Cross-midnight shift flag. |
| `active` | `boolean` | NO | true | - | Active shift flag. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Creation timestamp. |

---

### 3.3 `public.geofence_locations`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Geofence UUID. |
| `name_en` | `text` | NO | - | - | Site location name (English). |
| `name_ar` | `text` | NO | - | - | Site location name (Arabic). |
| `latitude` | `numeric(10, 7)`| NO | - | - | Center latitude. |
| `longitude` | `numeric(10, 7)`| NO | - | - | Center longitude. |
| `radius_meters` | `numeric` | NO | 100.0 | CHECK (`radius_meters > 0`) | Permitted radius buffer. |
| `is_active` | `boolean` | NO | true | - | Active site flag. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Creation timestamp. |

---

## 4. Biometrics, Face Verification & Anti-Spoofing

### 4.1 `public.biometric_verification_tokens`
Single-use cryptographic challenge tokens for secure face verification.

| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Token UUID. |
| `employee_id` | `uuid` | NO | - | FK -> `profiles(id)` ON DELETE CASCADE | Target employee. |
| `token` | `text` | NO | - | UNIQUE | Cryptographic HMAC challenge token. |
| `nonce` | `text` | NO | - | - | Hardware & session entropy string. |
| `liveness_challenge` | `jsonb` | NO | - | - | Gesture sequence required (blink, nod, smile). |
| `expires_at` | `timestamptz`| NO | - | - | Expiration timestamp (120s TTL). |
| `is_consumed` | `boolean` | NO | false | - | Replay prevention flag. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Issuance timestamp. |

**Indexes:**
- `idx_biometric_tokens_token` ON (`token`)
- `idx_biometric_tokens_exp` ON (`expires_at`, `is_consumed`)

---

### 4.2 `public.security_settings`
System-wide anti-spoofing and security rules.

| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Settings singleton UUID. |
| `require_biometrics` | `boolean` | NO | true | - | Global biometric requirement. |
| `require_geofencing` | `boolean` | NO | true | - | Global geofencing requirement. |
| `block_mock_locations`| `boolean` | NO | true | - | Rejects simulated GPS providers. |
| `face_match_threshold` | `numeric` | NO | 0.85 | CHECK (`face_match_threshold BETWEEN 0.5 AND 1.0`) | Minimum cosine similarity score. |
| `max_failed_attempts` | `integer` | NO | 3 | - | Maximum consecutive failures. |
| `lockout_duration_minutes` | `integer` | NO | 15 | - | Lockout duration after threshold breach. |
| `anti_tamper_salt` | `text` | YES | NULL | - | Server-side hardware signature salt. |
| `updated_at` | `timestamptz`| NO | `clock_timestamp()` | - | Settings update timestamp. |

---

## 5. Leaves, Vacations & Working Days

### 5.1 `public.leave_types`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Leave Type UUID. |
| `code` | `text` | NO | - | UNIQUE | Code (`annual`, `sick`, `casual`, `unpaid`, etc.). |
| `name_en` | `text` | NO | - | - | English description. |
| `name_ar` | `text` | NO | - | - | Arabic description. |
| `default_days_per_year` | `numeric`| NO | 21.0 | - | Yearly entitlement baseline. |
| `requires_attachment` | `boolean` | NO | false | - | Medical/proof document requirement. |
| `is_paid` | `boolean` | NO | true | - | Paid leave flag. |
| `active` | `boolean` | NO | true | - | Active leave type flag. |

---

### 5.2 `public.leave_balances`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Balance UUID. |
| `employee_id` | `uuid` | NO | - | FK -> `profiles(id)` ON DELETE CASCADE | Associated employee. |
| `leave_type_id` | `uuid` | NO | - | FK -> `leave_types(id)` ON DELETE CASCADE | Associated leave type. |
| `year` | `integer` | NO | - | - | Balance calendar year. |
| `allocated_days` | `numeric` | NO | 21.0 | - | Total days assigned for year. |
| `used_days` | `numeric` | NO | 0.0 | - | Consumed approved days. |
| `pending_days` | `numeric` | NO | 0.0 | - | Days locked in pending requests. |

**Constraints:** `UNIQUE (employee_id, leave_type_id, year)`

---

### 5.3 `public.leave_requests`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Request UUID. |
| `employee_id` | `uuid` | NO | - | FK -> `profiles(id)` ON DELETE CASCADE | Requester employee. |
| `leave_type_id` | `uuid` | NO | - | FK -> `leave_types(id)` ON DELETE RESTRICT | Requested leave category. |
| `start_date` | `date` | NO | - | - | Leave start date. |
| `end_date` | `date` | NO | - | - | Leave end date. |
| `days_count` | `numeric` | NO | - | CHECK (`days_count > 0`) | Total effective working days absent. |
| `reason` | `text` | NO | - | - | Written justification. |
| `attachment_url` | `text` | YES | NULL | - | Medical report or supporting proof. |
| `status` | `text` | NO | 'pending' | CHECK (`status IN ('pending', 'approved_by_manager', 'approved', 'rejected', 'cancelled')`) | Workflow state. |
| `manager_action_by` | `uuid` | YES | NULL | FK -> `profiles(id)` | Manager reviewer ID. |
| `manager_action_at` | `timestamptz`| YES| NULL | - | Manager action timestamp. |
| `hr_action_by` | `uuid` | YES | NULL | FK -> `profiles(id)` | HR final approver ID. |
| `hr_action_at` | `timestamptz`| YES| NULL | - | HR approval timestamp. |
| `rejection_reason` | `text` | YES | NULL | - | Rejection feedback. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Submission timestamp. |

---

## 6. Payroll, Solaf (Advances), Allowances & Penalties

### 6.1 `public.advances` (Employee Loans / Solaf)
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Advance UUID. |
| `employee_id` | `uuid` | NO | - | FK -> `profiles(id)` ON DELETE CASCADE | Borrower employee. |
| `amount` | `numeric` | NO | - | CHECK (`amount > 0`) | Total requested loan amount. |
| `repayment_months` | `integer` | NO | 1 | CHECK (`repayment_months BETWEEN 1 AND 24`) | Number of monthly deduction cycles. |
| `deduction_start_date` | `date`| NO | - | - | First payroll deduction month. |
| `monthly_installment` | `numeric`| NO | - | CHECK (`monthly_installment > 0`) | Monthly scheduled installment. |
| `remaining_balance` | `numeric`| NO | - | CHECK (`remaining_balance >= 0`) | Remaining unpaid principal. |
| `reason` | `text` | NO | - | - | Reason for advance request. |
| `status` | `text` | NO | 'pending' | CHECK (`status IN ('pending', 'approved', 'rejected', 'in_progress', 'completed')`) | Loan status. |
| `approved_by` | `uuid` | YES | NULL | FK -> `profiles(id)` | Approving officer ID. |
| `approved_at` | `timestamptz`| YES| NULL | - | Approval timestamp. |
| `rejection_reason` | `text` | YES | NULL | - | Rejection notes. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Request submission timestamp. |

---

### 6.2 `public.advance_installments`
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Installment UUID. |
| `advance_id` | `uuid` | NO | - | FK -> `advances(id)` ON DELETE CASCADE | Parent loan record. |
| `installment_number` | `integer`| NO | - | - | Sequence index (1, 2, ...). |
| `due_date` | `date` | NO | - | - | Expected payroll deduction date. |
| `amount` | `numeric` | NO | - | CHECK (`amount > 0`) | Scheduled installment amount. |
| `is_deducted` | `boolean` | NO | false | - | Whether processed in payroll. |
| `payroll_item_id` | `uuid` | YES | NULL | - | Linked payroll pay slip line item. |
| `deducted_at` | `timestamptz`| YES| NULL | - | Execution timestamp. |

---

## 7. KPI & Performance Evaluations (Quarterly & 3-Layer)

### 7.1 `public.kpi_criteria` (The Criteria Catalog)
| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Criterion UUID. |
| `code` | `text` | YES | NULL | UNIQUE | Standardized code (e.g. `KPI-101`). |
| `name_en` | `text` | NO | - | - | English metric name. |
| `name_ar` | `text` | NO | - | - | Arabic metric name. |
| `description_en` | `text` | YES | '' | - | English definition. |
| `description_ar` | `text` | YES | '' | - | Arabic definition. |
| `criterion_type` | `text` | NO | - | CHECK (`criterion_type IN ('common', 'position_specific', 'custom')`) | Layer classification. |
| `category` | `text` | NO | 'technical' | CHECK (`category IN ('behavioral', 'technical', 'quality', 'productivity', 'safety', 'coordination')`) | Functional category. |
| `scoring_scale` | `text` | NO | 'percentage'| CHECK (`scoring_scale IN ('rating_5', 'percentage', 'count', 'boolean')`) | Scale format. |
| `max_scale_value` | `numeric` | NO | 100 | - | Maximum scale range value. |
| `default_weight` | `numeric` | NO | 0.05 | CHECK (`default_weight > 0 AND default_weight <= 1.0`) | Normalized weight fraction (e.g. 0.10 = 10%). |
| `default_target` | `numeric` | NO | 1.0 | - | Target benchmark (e.g. 0.95 = 95%). |
| `unit` | `text` | NO | '%' | - | Measurement unit (%, count, scale). |
| `how_measured_en` | `text` | YES | NULL | - | Calculation methodology (English). |
| `how_measured_ar` | `text` | YES | NULL | - | Calculation methodology (Arabic). |
| `is_required` | `boolean` | NO | true | - | Mandatory evaluation requirement. |
| `is_active` | `boolean` | NO | true | - | Active in catalog flag. |
| `display_order` | `integer` | NO | 0 | - | Sort order. |
| `created_at` | `timestamptz`| NO | `clock_timestamp()` | - | Ingestion timestamp. |

---

### 7.2 `public.kpi_templates` & `public.kpi_template_items`
Enforces position and grade mapping ensuring:
$$\sum \text{weights} = 1.0 \quad (100\%)$$

- `kpi_templates`: Contains `id`, `name_en`, `name_ar`, `position_id`, `job_grade_id`, `common_weight_pct` (40.0%), `position_weight_pct` (60.0%), `version`, `status` (`draft`, `published`, `archived`).
- `kpi_template_items`: Contains `id`, `template_id`, `criterion_id`, `weight` (numeric 0.0 to 1.0), `target_benchmark`, `display_order`.

---

### 7.3 `public.kpi_quarterly_evaluations`
Independent headers for quarterly reviews.

| Column | Type | Nullable | Default | Constraints & References | Description |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Evaluation UUID. |
| `employee_id` | `uuid` | NO | - | FK -> `profiles(id)` ON DELETE CASCADE | Evaluated employee. |
| `evaluator_id` | `uuid` | NO | - | FK -> `profiles(id)` ON DELETE RESTRICT | Evaluating supervisor. |
| `evaluation_year` | `integer`| NO | - | CHECK (`evaluation_year BETWEEN 2020 AND 2100`) | Review year. |
| `quarter` | `text` | NO | - | CHECK (`quarter IN ('q1', 'q2', 'q3', 'q4')`) | Review quarter. |
| `template_id` | `uuid` | YES | NULL | FK -> `kpi_templates(id)` ON DELETE SET NULL | Template reference. |
| `status` | `text` | NO | 'draft' | CHECK (`status IN ('draft', 'submitted', 'returned', 'approved')`) | Evaluation state. |
| `score` | `numeric` | NO | 0.0 | CHECK (`score BETWEEN 0.0 AND 100.0`) | Overall weighted score achieved (0-100%). |
| `common_score` | `numeric` | YES | 0.0 | - | Layer 1 score (out of 40%). |
| `position_score`| `numeric` | YES | 0.0 | - | Layer 2 score (out of 60%). |
| `rating_tier` | `text` | YES | 'Pending Evaluation' | - | Rating label (e.g. Excellent, Good). |
| `return_reason` | `text` | YES | NULL | - | Mandatory feedback if returned. |
| `notes` | `jsonb` | NO | `'{"strengths":"","growthAreas":"","recommendations":""}'::jsonb` | - | Qualitative comments. |
| `submitted_at` | `timestamptz`| YES| NULL | - | Date submitted to HR. |
| `returned_at` | `timestamptz`| YES| NULL | - | Date returned for revision. |
| `approved_at` | `timestamptz`| YES| NULL | - | Date approved by HR. |

**Constraints:** `UNIQUE (employee_id, evaluation_year, quarter)`

---

### 7.4 `public.kpi_quarterly_items`
Frozen snapshot of line items evaluated per quarter.
- `id` (`uuid`, PK)
- `evaluation_id` (`uuid`, FK -> `kpi_quarterly_evaluations(id)` ON DELETE CASCADE)
- `criterion_id` (`uuid`, FK -> `kpi_criteria(id)`)
- `criterion_name_en` (`text`), `criterion_name_ar` (`text`)
- `criterion_type` (`text`), `category` (`text`)
- `weight` (`numeric`), `target_benchmark` (`numeric`)
- `actual_value` (`numeric`), `achievement_rate` (`numeric`), `weighted_score` (`numeric`)
- `comments` (`text`)

---

### 7.5 `public.kpi_evaluation_transitions`
Immutable audit trail tracking state progression and revision reasons.
- `id` (`uuid`, PK)
- `evaluation_id` (`uuid`, FK -> `kpi_quarterly_evaluations(id)` ON DELETE CASCADE)
- `actor_id` (`uuid`, FK -> `profiles(id)`)
- `actor_name` (`text`)
- `from_status` (`text`), `to_status` (`text`)
- `reason` (`text`)
- `created_at` (`timestamptz`, DEFAULT `clock_timestamp()`)

---

## 8. Contracts, Tasks, Custody, Chat & Communications

### 8.1 `public.contracts` & `public.contract_notifications`
- Tracks employment contracts with start, end, renewal notice dates, probation end dates, and automated 60-day expiry warning triggers.

### 8.2 `public.tasks`
- Dispatch and ticketing for site engineers, with GPS check-in at customer site locations, snag reporting, and milestone completion flags.

### 8.3 `public.audit_logs`
- System-wide security trail tracking: `id`, `actor_id`, `action`, `entity_name`, `entity_id`, `old_values` (JSONB), `new_values` (JSONB), `ip_address`, `created_at`.
