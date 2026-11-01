# INT-HR — Employee Portal APIs & Business Logic Specification

This document provides a comprehensive technical reference for all **Employee-facing APIs, Server Functions, Data Contracts, and Business Logic** in the INT-HR platform.

---

## Architecture & Authentication Overview

### Execution Model
- **Pure Static SPA with Client Execution Adapter**: The application runs as a static Single Page Application (SPA). TanStack React Start server functions (`createServerFn`) execute via a client-side shim using the authenticated Supabase client (`supabase-js`) directly against Supabase PostgREST and Auth endpoints.
- **Authorization Boundary**: The authorization boundary is enforced at the database level via **Row Level Security (RLS)** and user session tokens (`Bearer JWT`). Role context is resolved directly from the authenticated `user_roles` database table (never from browser-persisted claims).
- **Middleware**: `requireSupabaseAuth` extracts the user session, verifies the access token, verifies account status (`profiles.status === 'Active'`), and passes the authenticated `userId` and `supabase` client to the function context.

---

## 1. Authentication & Identity Management

### 1.1 Password Authentication
- **Operation**: `supabase.auth.signInWithPassword`
- **Method**: `POST` (`/auth/v1/token?grant_type=password`)
- **Payload**:
  ```json
  {
    "email": "employee@example.com",
    "password": "SecretPassword123!"
  }
  ```
- **Business Logic**:
  1. Authenticates credentials against Supabase Auth.
  2. **Active Status Defense**: Inspects `profiles.status` and `profiles.inactive_reason` for the authenticated `userId`.
  3. If status is `Inactive`, the session is immediately invalidated via `signOut()`, and an error is returned: `"Account is inactive"`.
  4. Calls `ensureOnboarded()` to verify profile integrity and default role assignment.
  5. Determines the primary role from `user_roles` and redirects to the role home (`/employee`).

### 1.2 Onboarding Verification
- **Function**: `ensureOnboarded` (`src/backend/functions/onboarding.functions.ts`)
- **Method**: `POST`
- **Payload**: None (authenticated context)
- **Response**:
  ```json
  {
    "ok": true,
    "userId": "uuid-v4",
    "roles": ["employee"]
  }
  ```
- **Business Logic**:
  1. Checks if a row in `profiles` exists for `auth.uid()`. If not, creates one using user metadata (email, display name).
  2. Ensures at least the `employee` role exists in `user_roles`.

### 1.3 Face Biometric Login
- **Function**: `getFaceDescriptorForLogin` (`src/backend/functions/biometrics.functions.ts`)
  - **Method**: `POST`
  - **Payload**: `{ "data": { "email": "employee@example.com" } }`
  - **Returns**: Stored reference face descriptor embeddings (`Float32Array` serialized) or null.
- **Function**: `faceLogin` (`src/backend/functions/biometrics.functions.ts`)
  - **Method**: `POST`
  - **Payload**:
    ```json
    {
      "data": {
        "email": "employee@example.com",
        "descriptor": [0.123, -0.456, 0.789, "...128 dimensions"],
        "device_id": "device-fingerprint-uuid"
      }
    }
    ```
  - **Business Logic**:
    1. Looks up profile by email. If status is `Inactive`, rejects immediately.
    2. Computes Euclidean distance between supplied descriptor and stored face template.
    3. Requires distance `< 0.45` (matching threshold).
    4. Logs biometric authentication attempt to `biometric_audit_logs`.
    5. Creates a secure authenticated session.

### 1.4 WebAuthn / Passkey Authentication
- **Function**: `webauthnAuthOptions` & `webauthnAuthVerify` (`src/backend/functions/biometrics.functions.ts`)
  - **Step 1: Request Challenge**: Sends employee email to generate WebAuthn challenge options.
  - **Step 2: Browser Prompt**: Navigator prompts fingerprint / Touch ID / Windows Hello.
  - **Step 3: Verification**: Verifies signed challenge against stored public key credential.

### 1.5 Current User & Profile Details
- **Function**: `getMe` (`src/backend/functions/auth.functions.ts`)
  - **Method**: `GET`
  - **Response**:
    ```json
    {
      "profile": {
        "id": "uuid",
        "full_name": "Ahmed Mansour",
        "emp_code": "EMP-0142",
        "status": "Active",
        "face_required": true,
        "device_check_required": false
      },
      "roles": ["employee"]
    }
    ```
- **Function**: `getMyProfileDetails` (`src/backend/functions/auth.functions.ts`)
  - **Method**: `GET`
  - **Response**: Includes department name, position, direct manager, contract details (start date, end date, remaining days), salary mode (`gross` / `net`), and salary amount.

---

## 2. Device Fingerprinting & Binding

All employee actions can be bound to approved hardware devices to prevent buddy punching and unauthorized terminal access.

### 2.1 Register Current Device
- **Function**: `registerMyDevice` (`src/backend/functions/devices.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "device_id": "fingerprint-hash-v2",
      "device_name": "Samsung Galaxy S23",
      "device_type": "mobile",
      "user_agent": "Mozilla/5.0 ...",
      "browser_info": { "name": "Chrome Mobile", "version": "120.0" },
      "ip_address": "197.35.x.x"
    }
  }
  ```
- **Business Logic**:
  1. Inserts or updates a record in `employee_devices`.
  2. Default status is `pending` unless auto-approval is enabled.
  3. Records initial registration metadata and IP.

### 2.2 List My Devices
- **Function**: `listMyDevices` (`src/backend/functions/devices.functions.ts`)
- **Method**: `GET`
- **Response**: Array of registered devices with status (`pending`, `approved`, `rejected`), last active timestamp, and device details.

### 2.3 Remove Device
- **Function**: `removeMyDevice` (`src/backend/functions/devices.functions.ts`)
- **Method**: `POST`
- **Payload**: `{ "data": { "id": "device-uuid" } }`
- **Business Logic**: Deletes device binding so the employee can re-register a new device.

---

## 3. Biometric Verification & Anti-Spoofing Tokens

To prevent replay attacks and GPS spoofing when punching in/out, biometric scans issue single-use tokens valid for 2 minutes.

### 3.1 Face Enrollment
- **Function**: `enrollFace` (`src/backend/functions/biometrics.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "descriptor": [0.012, -0.045, "...128 dimensions"],
      "device_id": "device-fingerprint"
    }
  }
  ```
- **Business Logic**:
  1. Stores normalized face embedding vectors into `employee_biometrics`.
  2. Updates `profiles.face_enrolled = true`.
  3. Triggers `syncMyFaceEnrollmentNotice()` to notify the user.

### 3.2 Live Face Verification & Token Issuance
- **Function**: `verifyFace` (`src/backend/functions/biometrics.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "descriptor": [0.012, -0.045, "...128 dimensions"],
      "action": "check_in",
      "device_id": "device-id",
      "lat": 30.0444,
      "lng": 31.2357,
      "accuracy_m": 12.5
    }
  }
  ```
- **Business Logic**:
  1. Loads employee's stored face template.
  2. Calculates Euclidean distance. Threshold is strictly `<= 0.45`.
  3. Validates liveness and anti-spoofing flags.
  4. Generates a secure, cryptographically random `token` stored in `biometric_verification_tokens`.
  5. Binds `snapshot_lat`, `snapshot_lng`, and `snapshot_accuracy_m` to the token.
  6. Sets `expires_at = now() + 2 minutes`.
  7. Returns `{ "verified": true, "token": "bio_tok_xyz123", "distance": 0.28 }`.

---

## 4. Attendance & Geofencing Engine

### 4.1 Check-In (`checkIn`)
- **Function**: `checkIn` (`src/backend/functions/attendance.functions.ts`)
- **Method**: `POST`
- **Payload (`AttendanceCheckSchema`)**:
  ```json
  {
    "data": {
      "lat": 30.044420,
      "lng": 31.235712,
      "accuracy_m": 15.2,
      "note": "Morning check-in",
      "branch": "Main HQ",
      "device_id": "dev_hash_892",
      "biometric_token": "bio_tok_xyz123",
      "biometric_method": "face",
      "client_epoch_ms": 1729639200000,
      "gps_age_ms": 1200,
      "gps_sample_count": 5,
      "altitude": 42.1,
      "heading": 180.5,
      "speed": 0.0,
      "mock_detected": false
    }
  }
  ```

#### Detailed Check-In Business Logic:
1. **Rate Limiting & Cooldown**:
   - `enforceAttendanceRateLimit()` enforces minimum cooldown between punches (prevents rapid-fire duplicate submissions).
2. **Account Status Verification**:
   - Confirms employee is `Active`.
3. **Daily Record Check**:
   - Checks if a record exists for today in `attendance_records` for `employee_id`.
   - If already checked in (`in_time` is not null), rejects: `"Already checked in for today"`.
4. **Device Authorization Check**:
   - If `profiles.device_check_required` is enabled:
     - Looks up device in `employee_devices`.
     - Device must exist and have `status === 'approved'`. Otherwise rejects punch.
5. **Biometric Token Consumption**:
   - If `profiles.face_required !== false`:
     - Reads `biometric_verification_tokens` for the given token.
     - Checks `used_at` (anti-replay check). If already used, rejects: `"Biometric verification already used"`.
     - Checks `expires_at`. If expired (> 2 mins), rejects: `"Biometric verification expired"`.
     - Marks token `used_at = now()`.
6. **Mock Location & GPS Spoofing Defense**:
   - If `mock_detected === true`, accuracy `> 100m`, or location dispersion indicates teleportation/mocking:
     - Flags attendance record as suspicious (`review_required = true`, reason: `mock_detected`).
7. **Geofencing & Work Location Matching**:
   - Loads employee's assigned work locations from `employee_work_locations` or branch master `branches`.
   - Calculates Haversine distance:
     $$\text{dist} = 2 R \arcsin \left( \sqrt{\sin^2(\Delta\phi/2) + \cos(\phi_1)\cos(\phi_2)\sin^2(\Delta\lambda/2)} \right)$$
   - Checks if distance $\le \text{radius\_meters}$ (default 100m–300m).
   - If outside:
     - If geofence is strict, rejects check-in.
     - If permissive, marks record as `Out of range` with distance logged for manager review.
8. **Wi-Fi / IP Network Validation**:
   - Validates client IP or connected Wi-Fi BSSID against allowed company networks in `network_assignments`.
9. **Shift & Punctuality Calculation**:
   - Compares punch time against employee assigned shift (`shifts` table).
   - Calculates grace period (e.g. 15 minutes).
   - Computes status: `On Time`, `Late`, or `Half Day`.
   - Records late minutes for automated penalty deduction rules.
10. **Reverse Geocoding**:
    - Converts `(lat, lng)` to human-readable address string and stores in `in_address`.
11. **Insertion**:
    - Inserts into `attendance_records` with timestamp, coordinates, device ID, status, and verification metrics.

### 4.2 Check-Out (`checkOut`)
- **Function**: `checkOut` (`src/backend/functions/attendance.functions.ts`)
- **Method**: `POST`
- **Payload**: Same schema as `checkIn`.

#### Detailed Check-Out Business Logic:
1. Verifies existing check-in row exists for today.
2. If already checked out (`out_time` is not null), rejects.
3. Consumes single-use biometric token (if face verification required).
4. Verifies geofence / device permissions.
5. Sets `out_time = now()`, `out_lat`, `out_lng`, `out_address`.
6. **Worked Hours & Overtime Calculation**:
   - `total_hours = (out_time - in_time) - break_minutes`.
   - Compares against standard shift duration.
   - Calculates overtime hours if checkout occurs after shift end and overtime rules permit.
   - Updates `attendance_records` and triggers timeline aggregation.

### 4.3 My Attendance History
- **Function**: `listMyAttendance` (`src/backend/functions/attendance.functions.ts`)
  - **Method**: `GET`
  - **Returns**: Last 60 days of attendance entries including punch times, worked hours, statuses (`Present`, `Late`, `Absent`, `Excused`), and geofence locations.

### 4.4 Pre-Check Readiness Validation
- **Function**: `listMyCheckValidations` (`src/backend/functions/attendance.functions.ts`)
  - **Method**: `POST`
  - **Returns**: Live status of geofence proximity (nearest branch, meters away, inside/outside), device status, network match, and biometric enrollment state.

---

## 5. Workday Timeline & Travel Tracking

Tracks continuous shifts, site visits, and field trips throughout the workday.

### 5.1 Daily Workday Overview
- **Function**: `getEmployeeDailyWorkday` (`src/backend/functions/workday.functions.ts`)
- **Method**: `POST`
- **Payload**: `{ "data": { "employee_id": "uuid", "date": "2026-10-22" } }`
- **Returns**:
  - Punch in/out timestamps.
  - Active timeline events (in-office, field travel, break, departure).
  - Shift schedules and target hours.

### 5.2 Field Travel / Trip Start
- **Function**: `startTravel` (`src/backend/functions/workday.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "trip_id": "optional-trip-uuid",
      "lat": 30.0511,
      "lng": 31.2401,
      "note": "Departing to client site"
    }
  }
  ```
- **Business Logic**: Records start of mobile travel event and updates employee status on manager live maps.

### 5.3 Complete Travel
- **Function**: `completeTravel` (`src/backend/functions/workday.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "trip_id": "optional-trip-uuid",
      "lat": 30.0892,
      "lng": 31.3120,
      "distance_km": 14.5,
      "note": "Arrived at destination"
    }
  }
  ```
- **Business Logic**: Computes trip duration and distance, logs to travel reimbursement queue if trip allowances are enabled.

---

## 6. Leave Management & Vacation Balances

### 6.1 List Active Leave Types
- **Function**: `listActiveLeaveTypes` (`src/backend/functions/leaves.functions.ts`)
- **Method**: `GET`
- **Returns**: List of active leave categories (Annual, Sick, Unpaid, Maternity/Paternity, Compassionate, Casual) with paid flags and max day limits.

### 6.2 My Leave Balances
- **Function**: `listMyLeaveBalances` (`src/backend/functions/leave-balances.functions.ts`)
- **Method**: `GET`
- **Returns**:
  ```json
  [
    {
      "leave_type_id": "uuid-annual",
      "leave_type_name": "Annual Leave",
      "total_allowed": 21,
      "taken": 5,
      "pending": 2,
      "remaining": 14
    }
  ]
  ```

### 6.3 Submit Leave Request
- **Function**: `submitLeave` (`src/backend/functions/leaves.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "leave_type_id": "uuid",
      "start_date": "2026-11-01",
      "end_date": "2026-11-05",
      "reason": "Family vacation",
      "attachment_url": "https://supabase.../storage/docs/medical.pdf"
    }
  }
  ```

#### Business Logic:
1. **Date Validation**: Ensures `end_date >= start_date` and start date is not in the past (unless backdated leave policy is allowed).
2. **Overlap Check**: Checks existing requests for `employee_id`. Rejects if overlapping with any `Pending` or `Approved` leave.
3. **Working Day Calculation**: Subtracts weekly off days and official public holidays from the calendar span to determine actual days deducted.
4. **Balance Verification**:
   - Queries `leave_balances`.
   - Rejects if `remaining_days < requested_days` for deductible leave types.
5. **Approval Routing**:
   - Inserts record into `leave_requests` with status `Pending`.
   - Dispatches in-app notification to the employee's direct manager.

### 6.4 Cancel Leave
- **Function**: `cancelLeave` (`src/backend/functions/leaves.functions.ts`)
- **Method**: `POST`
- **Payload**: `{ "data": { "id": "leave-request-uuid" } }`
- **Business Logic**: An employee can cancel a leave request if it is still `Pending`. If already `Approved`, only an HR admin can revoke it.

---

## 7. Short-Term Permissions (Excuse / Departure)

Employees can request short hourly permissions during work hours (e.g., medical appointment or personal errand).

### 7.1 Request Permission
- **Function**: `requestPermission` (`src/backend/functions/employee-permissions.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "permission_type": "personal",
      "date": "2026-10-25",
      "start_time": "11:00",
      "end_time": "13:00",
      "reason": "Doctor consultation"
    }
  }
  ```

#### Business Logic:
1. Calculates duration in hours (e.g. 2 hours).
2. **Monthly Quota Enforcement**:
   - Computes total permissions taken by the employee in the current calendar month.
   - Enforces company policy limits (e.g. maximum 4 hours or 2 requests per month).
3. Rejects if duration exceeds the allowed single-permission cap.
4. Inserts into `employee_permissions` with status `Pending`.
5. Alerts manager for immediate approval.

### 7.2 List My Permissions
- **Function**: `listEmployeePermissions` (`src/backend/functions/employee-permissions.functions.ts`)
- **Method**: `POST`
- **Payload**: `{ "data": { "page": 1, "pageSize": 20 } }`
- **Returns**: Paginated permission history with decision notes and approval statuses.

### 7.3 Cancel Permission
- **Function**: `cancelPermission` (`src/backend/functions/employee-permissions.functions.ts`)
- **Method**: `POST`
- **Payload**: `{ "data": { "id": "permission-uuid" } }`

---

## 8. Salary Advances & Loans

Enables employees to request salary advances with structured payroll installment deductions.

### 8.1 Advance Eligibility Check
- **Function**: `getAdvanceEligibility` (`src/backend/functions/advances.functions.ts`)
- **Method**: `GET`
- **Returns**:
  ```json
  {
    "eligible": true,
    "max_amount": 5000,
    "max_installments": 6,
    "active_advance_count": 0,
    "outstanding_balance": 0,
    "reason_if_ineligible": null
  }
  ```
- **Business Logic**:
  1. Checks if employee has passed probation period.
  2. Verifies whether existing un-repaid advances exceed the maximum threshold.
  3. Calculates max allowable advance based on monthly basic/net salary percentage.

### 8.2 Create Advance Request
- **Function**: `createAdvanceRequest` (`src/backend/functions/advances.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "amount": 3000,
      "reason": "Emergency home repairs",
      "installments_count": 3,
      "repayment_start_month": "2026-11"
    }
  }
  ```
- **State Machine Workflow**:
  $$\text{Draft} \longrightarrow \text{Pending Manager} \longrightarrow \text{Pending HR} \longrightarrow \text{Pending Finance} \longrightarrow \text{Approved / Paid}$$
- Generates amortization installment preview rows in `advance_installments`.

### 8.3 List My Advances
- **Function**: `listMyAdvances` (`src/backend/functions/advances.functions.ts`)
- **Method**: `GET`
- **Returns**: List of all submitted advance requests, payment status, remaining balance, and installment breakdown.

### 8.4 Cancel Advance
- **Function**: `cancelMyAdvance` (`src/backend/functions/advances.functions.ts`)
- **Method**: `POST`
- **Payload**: `{ "data": { "id": "advance-uuid" } }`
- **Business Logic**: Only allowed while status is `Pending Manager` or `Pending HR`. Once approved by finance, cancellation is locked.

---

## 9. Assigned Tasks & Performance Tracking

### 9.1 List Assigned Tasks
- **Function**: `listTasks` (`src/backend/functions/tasks.functions.ts`)
- **Method**: `GET`
- **Returns**: All tasks assigned to the authenticated user.
  - Returns `title`, `description`, `priority` (`low`, `medium`, `high`, `urgent`), `status` (`todo`, `in_progress`, `review`, `completed`), `due_date`, and assignee list.

### 9.2 Transition Task Status
- **Function**: `transitionTask` (`src/backend/functions/tasks.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "id": "task-uuid",
      "status": "in_progress",
      "comment": "Started working on draft"
    }
  }
  ```
- **Business Logic**:
  1. Verifies that the employee is an assignee of the task.
  2. Updates task status and logs the transition with timestamp and user ID into task audit history.

---

## 10. Team Chat & Internal Messaging

### 10.1 List My Channels
- **Function**: `listMyChannels` (`src/backend/functions/chat.functions.ts`)
- **Method**: `GET`
- **Returns**: Direct message conversations, team channels, and company-wide announcement channels with unread message counts.

### 10.2 Fetch Channel Messages
- **Function**: `getChannelMessages` (`src/backend/functions/chat.functions.ts`)
- **Method**: `POST`
- **Payload**: `{ "data": { "channelId": "uuid", "limit": 50, "before": "timestamp" } }`
- **Returns**: Paginated chat messages, attachments, sender profiles, and reactions.

### 10.3 Send Message
- **Function**: `sendMessage` (`src/backend/functions/chat.functions.ts`)
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "data": {
      "channelId": "uuid",
      "content": "Hello team, the report has been uploaded.",
      "attachment_url": null,
      "reply_to_id": null
    }
  }
  ```
- **Business Logic**:
  1. Checks channel permission: if announcements channel has `replies_allowed = false`, non-admin members cannot post.
  2. Inserts message into `chat_messages`.
  3. Increments unread counters for all channel recipients.

### 10.4 Unread Chat Total
- **Function**: `getChatUnreadTotal` (`src/backend/functions/chat.functions.ts`)
- **Method**: `GET`
- **Returns**: `{ "unreadCount": 4 }` (drives badge counters in top navigation).

---

## 11. Notifications & User Preferences

### 11.1 List My Notifications
- **Function**: `listMyDeliveries` (`src/backend/functions/notifications.functions.ts`)
- **Method**: `GET`
- **Returns**: In-app notifications (leave approvals, advance disbursements, shift changes, biometric reminders) ordered by timestamp descending.

### 11.2 Mark Notifications Read
- **Function**: `markMyNotificationsRead` (`src/backend/functions/notifications.functions.ts`)
- **Method**: `POST`
- **Payload**: `{ "data": { "ids": ["notification-uuid-1", "notification-uuid-2"] } }`
- **Business Logic**: Marks delivery rows as `read_at = now()`.

### 11.3 Notification Preferences
- **Function**: `getMyPreferences` & `saveMyPreferences` (`src/backend/functions/notifications.functions.ts`)
  - **GET**: Retrieves toggles for Email, SMS, and Web Push notifications.
  - **POST**: Updates subscription channels and device VAPID push tokens.

---

## 12. Security & Error Handling Matrix

| Error Code | HTTP / RPC Status | Trigger Condition | User Resolution |
| :--- | :--- | :--- | :--- |
| `account_inactive` | `403 Forbidden` | `profiles.status === 'Inactive'` | Contact HR administration to reactivate account. |
| `cooldown_active` | `429 Too Many Requests` | Repeated punch in under 60 seconds | Wait for cooldown timer before punching again. |
| `geofence_out_of_range`| `400 Bad Request` | Coordinates exceed designated branch radius | Move inside the geofenced office premises. |
| `mock_location_detected` | `400 Bad Request` | Spoofing provider or mock location flag active | Disable mock locations / fake GPS apps in Android settings. |
| `device_not_approved` | `403 Forbidden` | Current device ID is `pending` or `rejected` | Request device approval from HR administrator. |
| `face_required` | `400 Bad Request` | Check-in attempted without face biometric token | Perform face verification scan before punching. |
| `biometric_expired` | `400 Bad Request` | Biometric token age > 2 minutes | Re-scan face; token must be consumed within 120 seconds. |
| `biometric_replayed` | `400 Bad Request` | Token has already been consumed | Generate a fresh scan; tokens cannot be reused. |
| `leave_overlap` | `400 Bad Request` | Requested dates overlap existing request | Pick non-overlapping start and end dates. |
| `insufficient_balance`| `400 Bad Request` | Requested days exceed leave balance | Adjust leave duration or select unpaid leave. |
| `advance_limit_reached`| `400 Bad Request` | Amount exceeds annual limit or active loan exists | Settle existing advance before requesting another. |
