# System Architecture & Implementation Gaps Report

**Scope:** Attendance, Check-In / Check-Out, Working Days, Assignments, and Anti-Spoofing  
**Target Repository:** `int-hr-app2` & `android-integration-package`  
**Date:** 2026-10-24  

---

## Executive Summary

A deep code audit of the attendance and employee management workflows revealed critical disconnects between the administrative configuration UI (specifically the **Assignments** tab) and the server-side attendance execution engine. Most notably, allowed working days and date overrides configured in the admin interface are completely bypassed by hardcoded backend rules, and rich server validation reasons are obscured from users by generic static error messages.

---

## Identified Gaps

### 1. Disconnect Between `employee_working_days` and Attendance Enforcement
* **File Locations:**
  - Admin UI: [`src/components/EmployeeWorkingDays.tsx`](file:///d:/int/int-hr-app2/src/components/EmployeeWorkingDays.tsx)
  - Backend Controller: [`src/backend/functions/employee-working-days.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/employee-working-days.functions.ts)
  - Attendance Engine: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L170-L282) (lines 170–282 and 601–640)
* **The Gap:**
  - Under the Employee Details page (**Assignments** tab), administrators configure:
    1. Default weekly working days (`weekly` scope: Sun–Sat).
    2. Month-specific working day overrides (`month` scope).
    3. Specific calendar date overrides (`date_on` / `date_off` for individual day numbers 1–31).
  - This configuration is saved to the `employee_working_days` database table.
  - However, in `attendance.functions.ts` (both `checkIn` and `checkOut`), the server **never queries `employee_working_days`**.
  - Instead, the server hardcodes:
    ```typescript
    const isWeekend = dow === 5 || dow === 6; // Fri / Sat
    if (isWeekend && !isApprovedToWork) {
      return block("weekend", "Check-in blocked · today is a weekend (Friday / Saturday).");
    }
    ```
  - It only checks `profiles.approved_work_date === today`, which is an empty legacy column.
* **Impact:**
  - Even if an administrator explicitly authorizes an employee to work on Fridays/Saturdays or specific weekend dates via the Assignments tab, check-in is unconditionally rejected by policy.

---

### 2. Generic Error Masking in UI Replaces Actionable Feedback
* **File Locations:**
  - Employee Check-in: [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L337-L341) (lines 278, 294, 302, 339, 353, 371)
  - Manager Check-in: [`src/routes/manager.check.tsx`](file:///d:/int/int-hr-app2/src/routes/manager.check.tsx#L230-L246)
  - Internationalization: [`src/lib/i18n/index.tsx`](file:///d:/int/int-hr-app2/src/lib/i18n/index.tsx#L62-L95)
* **The Gap:**
  - The backend `checkIn` and `checkOut` functions return structured block payloads:
    `{ ok: false, blocked: true, code, params, reason }` with specific explanations (e.g. "today is a weekend", "already checked in today", "today is Annual Leave", "device unauthorized").
  - The application has an already implemented translation helper `formatBlocked(res)` in `src/lib/i18n/index.tsx` that provides bilingual, user-friendly explanations for every code.
  - `employee.check.tsx` even imports `formatBlocked`, but lines 339 and 353 hardcode:
    ```typescript
    if (res?.blocked) {
      toast.error("تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة.", { id: toastId });
      return;
    }
    ```
* **Impact:**
  - The user has no idea why their action was blocked (e.g., weekend policy vs. already checked in vs. leave vs. GPS timeout vs. network error), causing confusion and unnecessary IT support requests.

---

### 3. `CheckReadiness` Dashboard Shows False Positive Readiness
* **File Locations:**
  - Component: [`src/components/employee/CheckReadiness.tsx`](file:///d:/int/int-hr-app2/src/components/employee/CheckReadiness.tsx)
  - Query: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L803-L846) (`listMyAccess`)
* **The Gap:**
  - The "Before you check in" card checks only GPS coordinates, Network status, and Shift status.
  - If no work area is assigned, no network is restricted, and no shift is set, all 3 cards display green checkmarks with messages like *"You can check in at any time"* and *"No work area is assigned to you, so any location is accepted"*.
  - It does **not** check whether today is a non-working day, weekend, official holiday, or approved leave day.
* **Impact:**
  - The user sees 100% green checkmarks, completes biometric verification, clicks "Check In", and is immediately blocked.

---

### 4. Assigned Shifts Are Cosmetic and Never Enforced on the Server
* **File Locations:**
  - Assignment: [`src/components/EmployeeAssignmentsPicker.tsx`](file:///d:/int/int-hr-app2/src/components/EmployeeAssignmentsPicker.tsx#L9)
  - Backend Storage: [`src/backend/functions/employee-assignments.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/employee-assignments.functions.ts#L9) (`employee_shifts`)
  - Attendance Engine: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts)
* **The Gap:**
  - In the Assignments tab, admins assign shifts with defined start time, end time, and grace periods.
  - `listMyAccess` reads the shift solely to display early/on-time/late badges in `CheckReadiness.tsx`.
  - In `checkIn` (lines 152–500), `employee_shifts` is **never queried or evaluated**. There is no server gate checking whether the employee is checking in during their authorized shift or within allowed bounds.

---

### 5. Overnight Shift Check-Out Failure (`is_overnight`)
* **File Locations:**
  - Shift Schema: `shifts.is_overnight` boolean flag
  - Check-out Function: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L518-L527)
* **The Gap:**
  - In `checkOut`:
    ```typescript
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const { data: row } = await supabase
      .from("attendance")
      .select("id, in_time, out_time")
      .eq("employee_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (!row?.in_time) {
      return block("check_out_not_in", "Check-out blocked · you have not checked in today.");
    }
    ```
  - For overnight shifts (e.g. 22:00 to 06:00), check-in is logged on Day T (e.g., Thursday). Check-out occurs on the morning of Day T+1 (e.g., Friday).
  - The query looks for an attendance row on Day T+1 (`today`) and finds none, blocking check-out with `check_out_not_in`.

---

### 6. Orphaned `attendance_review_cases` (Flagged Records Have No Resolution UI)
* **File Locations:**
  - Server Inserts: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L370) (lines 370, 471, 714, 778)
  - Server Resolvers: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L1298) (`listReviewCases`, `resolveReviewCase`)
  - Routes: `src/routes/admin.*.tsx`, `src/routes/manager.*.tsx`
* **The Gap:**
  - High-risk GPS anomalies and boundary uncertainties flag check-ins as `pending_review` and insert entries into `attendance_review_cases`.
  - While backend query and mutation functions exist (`listReviewCases`, `resolveReviewCase`), **zero pages or components in the entire app call them**.
* **Impact:**
  - Flagged attendance records stay indefinitely in `pending` review status with no interface for HR, managers, or admins to review, approve, or reject them.

---

### 7. Overly Strict Face-to-Check-In Geolocation Divergence (150m Threshold)
* **File Locations:**
  - Anti-spoofing engine: [`src/backend/server/anti-spoofing.server.ts`](file:///d:/int/int-hr-app2/src/backend/server/anti-spoofing.server.ts#L144-L155)
* **The Gap:**
  - During the face verification step, GPS coordinates are captured and signed into `biometric_verification_tokens`.
  - Seconds later, when the user clicks "Check In", fresh coordinates are captured again.
  - If the distance between the two readings exceeds 150 meters, the backend marks `geo_face_discrepancy` and hard-rejects the attempt:
    ```typescript
    if (faceDivergenceM > 150) {
      outcome = "reject";
    }
    ```
* **Impact:**
  - On laptops, office PCs, and mobile devices indoors where geolocation relies on Wi-Fi AP mapping (accuracy typically 50m–300m), consecutive GPS readings regularly jump by 150–400 meters without any physical movement, causing legitimate check-ins to be blocked as "spoofing".

---

### 8. Dead Column `profiles.approved_work_date`
* **File Locations:**
  - Migration: `supabase/migrations/20260717140000_attendance_overrides.sql`
  - References: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L248) (lines 248, 251, 613, 616)
* **The Gap:**
  - `attendance.functions.ts` relies on `profileRow?.approved_work_date === today` as the sole bypass for weekend/holiday blocks.
  - However, there is no form, button, API, or RPC anywhere in the application to set or update `approved_work_date`. The column is completely orphaned.

---

### 9. Dual-Repository Parity (`android-integration-package`)
* **File Locations:**
  - Primary: `src/backend/functions/attendance.functions.ts`
  - Android package: `android-integration-package/src/backend/functions/attendance.functions.ts`
* **The Gap:**
  - Per project architectural rules, both copies must maintain identical business logic.
  - The identical weekend/working days disconnect and overnight shift issues exist in the `android-integration-package` directory.

---

## Project-Based Work & Site Operations Gaps

### 10. Corporate HQ Weekend Policy Incompatible with Project Site Operations
* **File Locations:**
  - Attendance Engine: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L172-L174)
  - Org Structure / Positions: `docs/migrations/045-seed-org-structure.sql` (Dept 204: Project Management, PMD, PM, PSE-II, PSE, PTECHS, PTECH)
* **The Gap:**
  - The company employs field and site staff (Project Managers, Project Site Engineers, Project Technicians) who operate on site projects with 6-day work weeks, Saturday operations, or shift rotations.
  - The attendance engine enforces a single, rigid corporate HQ calendar rule (`dow === 5 || dow === 6` is weekend).
  - Unless an individual bypass exists, any project engineer or technician assigned to an active project site trying to check in on a Saturday is automatically blocked with `"Check-in blocked · today is a weekend"`.

---

### 11. Missing "Project" Entity as an Operational Container
* **File Locations:**
  - Locations: [`src/routes/admin.work-locations.tsx`](file:///d:/int/int-hr-app2/src/routes/admin.work-locations.tsx), `geofence_locations`
  - Cost Centers: [`src/components/admin/CostCentersManager.tsx`](file:///d:/int/int-hr-app2/src/components/admin/CostCentersManager.tsx), `cost_centers`
  - Assignments: [`src/components/EmployeeAssignmentsPicker.tsx`](file:///d:/int/int-hr-app2/src/components/EmployeeAssignmentsPicker.tsx)
* **The Gap:**
  - Currently, Geofences (`geofence_locations`), Cost Centers (`cost_centers`), and Working Days (`employee_working_days`) operate as completely disconnected silos.
  - There is no first-class **Project** entity to group:
    1. **Project Sites / Geofences** (the physical project boundaries).
    2. **Project Working Calendar / Schedule** (e.g., Saturday working allowed, site shifts).
    3. **Assigned Project Team** (Project Manager, Site Engineers, Technicians).
    4. **Project Cost Center / Code**.
  - Without this, administrators must manually configure geofences, cost centers, and working days separately for every individual employee on every project.

---

### 12. Inflexible Geofence Assignment for Roaming & Field Project Engineers
* **File Locations:**
  - Frontend: [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx)
  - Backend: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L288-L340)
* **The Gap:**
  - Project engineers and technicians frequently travel between multiple customer project sites, sub-stations, or contractor yards.
  - If an employee is assigned to a specific project location, the presence engine enforces that exact geofence. If dispatched to a new site, temporary customer location, or emergency call-out, check-in is rejected (`isOutsideFence`).
  - There is no concept of a "Project Site Dispatch" or temporary site assignment. Admins either have to grant complete "Free Check-In" (removing all geofence security) or manually update location assignments before each site visit.

---

### 13. Active Task & Travel Interlocks Trapping Project Field Staff
* **File Locations:**
  - Check-out Function: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L569-L599)
* **The Gap:**
  - Check-out is blocked if any task is `in_progress` (`active_task_in_progress`) or a travel trip is active (`active_travel_in_progress`).
  - In project operations:
    - Site installation or maintenance tasks often span multiple days.
    - Field engineers travel between remote project sites and may experience connectivity loss or delayed trip closures.
  - Blocking attendance check-out because of an ongoing project task prevents the employee from signing out at the end of their shift, distorting worked hours and penalizing field staff.

---

### 14. Static Cost Center Attribution vs. Dynamic Project Hours Allocation
* **File Locations:**
  - Profile Schema: `profiles.cost_center_id`
  - Attendance Reporting: [`src/lib/attendance-report.ts`](file:///d:/int/int-hr-app2/src/lib/attendance-report.ts), [`src/components/admin/GroupedAttendanceReport.tsx`](file:///d:/int/int-hr-app2/src/components/admin/GroupedAttendanceReport.tsx)
* **The Gap:**
  - Profiles hold a single static `cost_center_id`.
  - When attendance is logged, the record stores geographic coordinates and address strings, but **does not capture the specific Project / Cost Center of that shift**.
  - If a project technician works on Project Alpha for 3 days and Project Beta for 2 days, the grouped attendance report allocates all 5 days to whatever single cost center is currently selected on the employee's profile. There is no shift-level project cost allocation.

---

### 15. Project Managers (PMs) Lack Site-Level Attendance Authorization
* **File Locations:**
  - Middleware: [`src/integrations/supabase/admin-auth-middleware.ts`](file:///d:/int/int-hr-app2/src/integrations/supabase/admin-auth-middleware.ts)
  - Attendance Functions: [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts)
* **The Gap:**
  - All attendance approvals, review case resolutions, and manual corrections require global `admin` or `hr` roles.
  - Project Managers leading site operations cannot approve weekend check-in requests, review flagged boundary exceptions, or authorize overtime for their project team members without being granted full global administrative access to the entire company HR database.

---

## Action Plan Recommendations

1. **Unify Working Days Resolution:**
   - Create a shared helper `isDateAllowedForEmployee(supabase, employeeId, dateIso)` that queries `employee_working_days` (checking `date_on`/`date_off`, then `month` overrides, then `weekly` default pattern).
   - Replace the hardcoded `dow === 5 || dow === 6` in both `checkIn` and `checkOut` with this helper.

2. **Introduce Project-Based Work Calendars:**
   - Allow working days to be inherited from a Project or Cost Center so that assigning an employee to a 6-day project site automatically authorizes Saturday check-ins for the entire project crew.

3. **Connect `formatBlocked` to UI Toast:**
   - In `employee.check.tsx` and `manager.check.tsx`, replace the hardcoded Arabic string with `toast.error(formatBlocked(res), { id: toastId })`.

4. **Enhance `CheckReadiness` & `listMyAccess`:**
   - Include `isWorkingDay`, `isHoliday`, and `onLeave` in the `listMyAccess` response so `CheckReadiness` warns employees *before* they verify biometrics if today is not an authorized working day.

5. **Support Overnight Shift in `checkOut`:**
   - If no check-in exists for `today`, inspect `today - 1 day` for an open overnight shift check-in (`out_time IS NULL`).

6. **Decouple Check-Out from Multi-Day Project Tasks:**
   - Allow employees to check out for the day even if an ongoing project task remains `in_progress`, warning them rather than hard-blocking sign-out.

7. **Shift-Level Project / Cost Center Tagging:**
   - Allow employees to select or auto-tag their check-in with the active Project/Cost Center of that shift so attendance reports reflect accurate project cost accounting.

8. **Expose Attendance Review UI & Delegated PM Approvals:**
   - Add a review queue tab in Admin Time Management or Manager Dashboard consuming `listReviewCases` and `resolveReviewCase`, allowing Project Managers to approve attendance exceptions for their site teams.

