# INT HR System — Full API Endpoints & Server Functions Specification

> **System Version:** 2.6.0  
> **Framework:** TanStack Start (`createServerFn`) RPC & Supabase PostgREST Endpoints  
> **Authentication:** Bearer JWT / Supabase Authenticated Cookie Context  
> **Validation Engine:** Zod Schemas (`z.object(...)`)  
> **Generated:** November 2026

---

## 1. Architectural Overview

All server endpoints are implemented as type-safe TanStack Start Server Functions. Each function:
1. Executes on the server within the `requireSupabaseAuth` middleware pipeline.
2. Extracts verified `userId` and authenticated Supabase client from server context.
3. Performs strict Zod schema validation on the request payload.
4. Executes queries subject to PostgreSQL Row-Level Security (RLS).
5. Returns typed JSON responses or throws standard HTTP-compatible error messages.

---

## 2. Authentication & Profile APIs

### 2.1 `getMe`
Retrieves the currently authenticated user session, database profile, and active roles.
- **Wire Path:** `/api/auth/me` (`POST`)
- **Required Roles:** Any authenticated user
- **Input Payload:** None
- **Response Format:**
  ```json
  {
    "id": "uuid",
    "email": "employee@int.com",
    "full_name": "Ahmed Mohamed",
    "emp_code": "INT-1016",
    "roles": ["employee", "manager"],
    "employeeId": "uuid"
  }
  ```
- **Errors:** `401 Unauthorized` if session cookie is missing or invalid.

### 2.2 `getMyProfileDetails`
Returns the full employee profile including department, position (EN/AR), manager, and allowances.
- **Wire Path:** `/api/auth/profile-details` (`GET`)
- **Required Roles:** Authenticated user (`id = auth.uid()`)
- **Response Format:**
  ```json
  {
    "id": "uuid",
    "emp_code": "INT-1016",
    "full_name": "Ahmed Mohamed",
    "full_name_ar": "أحمد محمد",
    "email": "a.mohamed@int.com",
    "phone": "+201012345678",
    "national_id": "29501011234567",
    "department": "Engineering",
    "position": "Junior ELV Site Engineer",
    "position_ar": "مهندس موقع تيار خفيف",
    "manager": "Tarek Hassan",
    "salary_mode": "monthly",
    "salary_amount": 15000,
    "hire_date": "2024-03-01"
  }
  ```

### 2.3 `changeAccountPassword`
Administrative password modification using the isolated `send-smtp-email` service.
- **Wire Path:** `/api/auth/change-password` (`POST`)
- **Required Roles:** `admin`
- **Input Payload:**
  ```typescript
  {
    targetUserId: string; // uuid of target account
    newPassword: string;  // min 8 characters with strength requirements
  }
  ```
- **Response Format:** `{ "success": true, "message": "Password updated successfully" }`
- **Errors:** `403 Forbidden` if caller is not an Admin.

---

## 3. Employee & Organizational Hierarchy APIs

### 3.1 `listEmployeesAdmin`
Paginated directory of all employee profiles with search and filter capabilities.
- **Wire Path:** `/api/employees/list-admin` (`POST`)
- **Required Roles:** `admin`, `hr`
- **Input Payload:**
  ```typescript
  {
    page: number;         // 1-based page index (default 1)
    pageSize: number;     // 15, 25, 50, 100 (default 15)
    search?: string;      // search by name or emp_code
    departmentId?: string;// filter by department UUID
    status?: string;      // 'active' | 'suspended' | 'terminated'
  }
  ```
- **Response Format:**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "emp_code": "INT-1016",
        "full_name": "Ahmed Mohamed",
        "full_name_ar": "أحمد محمد",
        "department": { "name_en": "Engineering", "name_ar": "الإدارة الهندسية" },
        "position": { "name_en": "Site Engineer", "name_ar": "مهندس موقع" },
        "status": "active"
      }
    ],
    "totalCount": 128,
    "page": 1,
    "pageSize": 15,
    "totalPages": 9
  }
  ```

### 3.2 `getMyTeam`
Returns direct reports and department subordinates for the calling manager.
- **Wire Path:** `/api/team/my-team` (`POST`)
- **Required Roles:** `manager`, `admin`
- **Input Payload:** None
- **Response Format:** Array of employee profiles scoped to the manager's reporting line.

---

## 4. Attendance, Geofencing & Biometric APIs

### 4.1 `createBiometricChallenge`
Generates a short-lived, single-use cryptographic token and liveness gesture requirement.
- **Wire Path:** `/api/biometrics/challenge` (`POST`)
- **Required Roles:** Authenticated employee
- **Input Payload:**
  ```typescript
  {
    deviceId: string; // Hardware client identifier
  }
  ```
- **Response Format:**
  ```json
  {
    "token": "hmac_challenge_token_string",
    "nonce": "random_nonce_bytes",
    "livenessSequence": ["blink", "nod"],
    "expiresAt": "2026-11-01T21:25:00Z"
  }
  ```

### 4.2 `checkInAttendance`
Executes biometric validation, GPS geofence distance computation, and logs official check-in.
- **Wire Path:** `/api/attendance/check-in` (`POST`)
- **Required Roles:** Authenticated employee
- **Input Payload:**
  ```typescript
  {
    latitude: number;           // GPS latitude
    longitude: number;          // GPS longitude
    accuracy: number;           // Accuracy in meters
    verificationToken: string;  // Single-use token from challenge
    selfieBase64?: string;      // Biometric capture image
  }
  ```
- **Verification Workflow:**
  1. Validates token is unconsumed and not expired (120s TTL).
  2. Compares coordinates with active `geofence_locations` using Haversine formula.
  3. Checks mock-location flags to prevent GPS spoofing.
  4. Records entry in `attendance_logs` with `type: 'check_in'`.
- **Response Format:**
  ```json
  {
    "success": true,
    "logId": "uuid",
    "timestamp": "2026-11-01T08:29:45+02:00",
    "isWithinGeofence": true,
    "siteName": "Cairo New Capital Site"
  }
  ```

### 4.3 `checkOutAttendance`
Executes end-of-shift verification and logs departure punch.
- **Wire Path:** `/api/attendance/check-out` (`POST`)
- **Required Roles:** Authenticated employee
- **Input Payload:** Same as `checkInAttendance`.

---

## 5. Leaves & Vacations APIs

### 5.1 `submitLeaveRequest`
Submits a formal leave request and reserves days from the employee balance.
- **Wire Path:** `/api/leaves/submit` (`POST`)
- **Required Roles:** Authenticated employee
- **Input Payload:**
  ```typescript
  {
    leaveTypeId: string;  // UUID from leave_types
    startDate: string;    // YYYY-MM-DD
    endDate: string;      // YYYY-MM-DD
    reason: string;       // Text explanation
    attachmentUrl?: string;// Optional file upload URL
  }
  ```
- **Business Logic:**
  - Computes net business days excluding weekends and official holidays.
  - Verifies available days in `leave_balances` for the current calendar year.
  - Inserts row in `leave_requests` with status `pending`.
- **Response Format:** `{ "success": true, "requestId": "uuid", "daysCount": 3 }`

### 5.2 `reviewLeaveRequest`
Manager or HR approval/rejection of submitted leave request.
- **Wire Path:** `/api/leaves/review` (`POST`)
- **Required Roles:** `manager` (for direct team), `hr`, `admin`
- **Input Payload:**
  ```typescript
  {
    requestId: string;
    action: "approve" | "reject";
    rejectionReason?: string; // Required if action === 'reject'
  }
  ```
- **Side Effect:** Deducts `allocated_days` and `used_days` in `leave_balances` if approved.

---

## 6. Payroll & Solaf (Advances) APIs

### 6.1 `applyAdvance` (Submit Solaf)
Requests a financial loan/advance against future monthly payroll cycles.
- **Wire Path:** `/api/advances/apply` (`POST`)
- **Required Roles:** Authenticated employee
- **Input Payload:**
  ```typescript
  {
    amount: number;               // Requested loan amount (EGP)
    repaymentMonths: number;      // 1 to 24 months
    deductionStartDate: string;   // YYYY-MM-DD (e.g. "2026-12-01")
    reason: string;               // Justification
  }
  ```
- **Validation:**
  - Checks `amount <= profile.annual_advance_limit`.
  - Ensures no currently outstanding unapproved or in-progress advance exists.
- **Response Format:** `{ "success": true, "advanceId": "uuid" }`

### 6.2 `approveAdvance`
Finance or Admin formal approval of loan request.
- **Wire Path:** `/api/advances/approve` (`POST`)
- **Required Roles:** `finance`, `admin`
- **Input Payload:** `{ advanceId: string }`
- **Side Effect:** Automatically inserts scheduled monthly installments into `advance_installments`.

---

## 7. KPI & Performance Evaluation APIs

### 7.1 `listKpiCriteria`
Returns active evaluation criteria filtered by layer.
- **Wire Path:** `/api/kpi/criteria/list` (`POST`)
- **Required Roles:** Authenticated user
- **Input Payload:**
  ```typescript
  {
    layer?: "all" | "common" | "role" | "custom";
  }
  ```
- **Response Format:**
  ```json
  [
    {
      "id": "uuid",
      "code": "KPI-101",
      "name_en": "Attendance & Punctuality",
      "name_ar": "الحضور والانضباط بمواعيد العمل",
      "layer": "common",
      "default_weight": 0.10,
      "default_target": 0.95,
      "unit": "%"
    }
  ]
  ```

### 7.2 `saveKpiCriterion`
Creates or updates a criterion in the catalog.
- **Wire Path:** `/api/kpi/criteria/save` (`POST`)
- **Required Roles:** `admin`, `hr`
- **Input Payload:**
  ```typescript
  {
    id?: string;
    code: string;
    name_en: string;
    name_ar: string;
    category_en: string;
    category_ar: string;
    layer: "common" | "role" | "custom";
    default_weight: number; // 0.05 to 1.0
    default_target: number; // 0.0 to 1.0
    unit: string;
    how_measured_en?: string;
    how_measured_ar?: string;
  }
  ```

### 7.3 `getQuarterlyEvaluation`
Fetches a specific quarter's evaluation header and scored line items.
- **Wire Path:** `/api/kpi/quarterly/get` (`POST`)
- **Required Roles:** `admin`, `hr`, `manager` (team), or self employee (if submitted/approved)
- **Input Payload:**
  ```typescript
  {
    employeeId: string;
    year: number;
    quarter: "q1" | "q2" | "q3" | "q4";
  }
  ```

### 7.4 `saveQuarterlyEvaluation`
Saves or submits a quarterly scorecard.
- **Wire Path:** `/api/kpi/quarterly/save` (`POST`)
- **Required Roles:** Direct `manager`, `admin`, `hr`
- **Input Payload:**
  ```typescript
  {
    employeeId: string;
    year: number;
    quarter: "q1" | "q2" | "q3" | "q4";
    items: Array<{
      criterionId: string;
      actualValue: number;
      comments?: string;
    }>;
    notes: {
      strengths: string;
      growthAreas: string;
      recommendations: string;
    };
    submitToHr?: boolean; // if true, status transitions to 'submitted'
  }
  ```
- **Server-Side Enforcement:**
  - Recalculates achievement: `achievement = Math.min(1.0, actual / target)`
  - Recomputes total weighted score: `totalScore = sum(achievement * weight * 100)`
  - Client cannot manipulate final score values.

### 7.5 `reviewQuarterlyEvaluation`
HR Admin formal approval or return for revision.
- **Wire Path:** `/api/kpi/quarterly/review` (`POST`)
- **Required Roles:** `hr`, `admin`
- **Input Payload:**
  ```typescript
  {
    evaluation_id: string;
    action: "approve" | "return";
    return_reason?: string; // MANDATORY (>= 5 chars) if action === 'return'
  }
  ```
- **Validation Rule:** If `action === 'return'`, throws an error if `return_reason` is missing or shorter than 5 characters.
- **Side Effect:** Inserts an immutable transition record in `kpi_evaluation_transitions` logging actor and reason.

### 7.6 `listPendingApprovals`
Returns the queue of submitted quarterly evaluations waiting for HR review.
- **Wire Path:** `/api/kpi/approvals/pending` (`POST`)
- **Required Roles:** `hr`, `admin`, `manager`
- **Input Payload:**
  ```typescript
  {
    year?: number;
    quarter?: "q1" | "q2" | "q3" | "q4";
  }
  ```
