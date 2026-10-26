# Comprehensive Security Gaps & Server-Side Handling Report

**Scope:** Application Security, Authorization Boundaries, Database RLS, Biometrics, and Client-Side Execution Risks  
**Target Repository:** `int-hr-app2` & `android-integration-package`  
**Date:** 2026-10-24  

---

## Executive Summary

The application operates as a **Pure Static SPA** (`start-shim.ts`). Server functions (`createServerFn`) do not run on a dedicated Node.js server; instead, they execute directly within the user's browser using the client Supabase library. 

Consequently, **any security check, rate limit, geofence validation, or anti-spoofing heuristic implemented in TypeScript (`*.server.ts` or `*.functions.ts`) is client-side code**. The only true security boundaries in the entire system are **PostgreSQL Row-Level Security (RLS) policies, database triggers, check constraints, and Supabase Edge Functions**.

A deep audit of PostgreSQL RLS policies and execution flows revealed critical authorization gaps that allow authenticated users to bypass attendance, biometrics, leave approvals, device restrictions, and profile controls directly via the Supabase PostgREST API.

---

## 1. Architectural Risk: The "Client-as-Server" Security Illusion

* **File Location:** [`src/lib/start-shim.ts`](file:///d:/int/int-hr-app2/src/lib/start-shim.ts), [`src/integrations/supabase/client.server.ts`](file:///d:/int/int-hr-app2/src/integrations/supabase/client.server.ts)
* **Mechanism:**
  - In a standard TanStack Start application, `createServerFn` executes on a trusted Node.js/SSR server with a protected `SUPABASE_SERVICE_ROLE_KEY`.
  - In this project, `vite.config.ts` shims `@tanstack/react-start` to `start-shim.ts`. All functions execute inside the user's browser with the user's public JWT token.
  - Furthermore, `client.server.ts` uses a Proxy that silently falls back to `browserSupabase` when running in the browser:
    ```typescript
    if (isBrowser) {
      return Reflect.get(browserSupabase as any, prop, receiver);
    }
    ```
* **Security Impact:**
  - An attacker does not need to interact with the UI buttons. They can open DevTools or use curl/Postman to send raw SQL or PostgREST queries directly to `https://<project-id>.supabase.co/rest/v1/`.
  - Any validation performed in TypeScript inside `attendance.functions.ts`, `anti-spoofing.server.ts`, or `device-registry.server.ts` is completely bypassed if the underlying PostgreSQL table permits the query.

---

## 2. Critical Database RLS Policy Gaps

### A. Direct Forgery of Attendance Records (`public.attendance`)
* **File Locations:**
  - Migration: `supabase/migrations/20260607185929_8f0f060c-80c1-402f-91a9-ef35f811c9e5.sql` (lines 134–137)
* **Vulnerable Policy:**
  ```sql
  CREATE POLICY "att self insert" ON public.attendance 
    FOR INSERT TO authenticated 
    WITH CHECK (employee_id = auth.uid());

  CREATE POLICY "att self update" ON public.attendance 
    FOR UPDATE TO authenticated
    USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
    WITH CHECK (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
  ```
* **The Gap:**
  - PostgreSQL allows any authenticated user to directly `INSERT` and `UPDATE` their own attendance records.
  - There are **no database-level checks** verifying geofences, face recognition tokens, device approvals, working days, weekends, holidays, or timestamps.
* **Exploit Vector:**
  - An employee can bypass the entire camera check, GPS check, geofence, and weekend restriction by sending a single HTTP POST request to `/rest/v1/attendance`:
    ```json
    {
      "employee_id": "<my-uuid>",
      "date": "2026-10-24",
      "in_time": "2026-10-24T09:00:00.000Z",
      "out_time": "2026-10-24T17:00:00.000Z",
      "status": "present",
      "decision": "accept",
      "free_check": true
    }
    ```
  - PostgreSQL will insert the record with status `201 Created`.

---

### B. Self-Generation of Biometric Verification Tokens (`public.biometric_verification_tokens`)
* **File Locations:**
  - Migration: `supabase/migrations/20261020010000_anti_spoofing_hardening.sql` (lines 31–34)
* **Vulnerable Policy:**
  ```sql
  CREATE POLICY "users manage own biometric tokens" ON public.biometric_verification_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  ```
* **The Gap:**
  - The policy grants `FOR ALL` (SELECT, INSERT, UPDATE, DELETE) to `authenticated` users on their own tokens.
  - While `verifyFace` in `biometrics.functions.ts` performs face vector math, the database allows the client to insert arbitrary tokens directly without performing any face recognition.
* **Exploit Vector:**
  - An attacker inserts a fake token directly into `biometric_verification_tokens`:
    ```json
    {
      "token": "spoofed-token-12345",
      "user_id": "<my-uuid>",
      "action": "check_in",
      "method": "face",
      "distance": 0.05,
      "expires_at": "2099-01-01T00:00:00Z"
    }
    ```
  - They then provide `"biometric_token": "spoofed-token-12345"` to the check-in handler, which queries the database, sees a matching unexpired token, and marks the biometric check as verified.

---

### C. Self-Approval of Devices on Registration (`public.employee_devices`)
* **File Locations:**
  - Migration: `supabase/migrations/20260617181040_a707198b-3094-4c4c-99ff-082121cf2473.sql` (lines 24–26)
* **Vulnerable Policy:**
  ```sql
  CREATE POLICY "Users register own devices"
    ON public.employee_devices FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
  ```
* **The Gap:**
  - While `status` defaults to `'pending'` in the table schema, the `WITH CHECK` clause does **not** enforce that `status` must be `'pending'` upon insertion.
* **Exploit Vector:**
  - An unauthorized device can be registered directly with `status = 'approved'`:
    ```json
    {
      "id": "unapproved_device_uuid",
      "user_id": "<my-uuid>",
      "label": "My Rogue Laptop",
      "status": "approved"
    }
    ```
  - The insert succeeds, granting immediate check-in access without administrator approval.

---

### D. Direct Profile Privilege & Restriction Tampering (`public.profiles`)
* **File Locations:**
  - Migration: `supabase/migrations/20260607183534_19e2a4dc-8618-4fa2-8e0f-be4d8bb64469.sql` (lines 58–60)
* **Vulnerable Policy:**
  ```sql
  CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
    WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
  ```
* **The Gap:**
  - The policy allows users to update **all columns** on their own row.
  - Sensitive administrative controls stored directly on `profiles` lack column-level protection or database trigger restrictions.
* **Exploit Vector:**
  - An employee can update their own row:
    - `face_required: false` (turns off biometric face requirement).
    - `device_check_required: false` (turns off device approval enforcement).
    - `approved_work_date: "2026-10-24"` (bypasses weekend/holiday blocks).
    - `annual_advance_limit: 1000000` (removes salary advance cap).
    - `salary_amount / salary_gross`: Modifies compensation data.
    - `status: "Active"` (re-activates an inactive/suspended account).

---

### E. Self-Approval of Leave Requests (`public.leaves`)
* **File Locations:**
  - Migration: `supabase/migrations/20260607190045_2474b4b1-2f15-4382-b5a6-5348aa426be2.sql` (lines 3–13)
* **Vulnerable Policy:**
  ```sql
  CREATE POLICY "leaves update scope" ON public.leaves FOR UPDATE TO authenticated USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'hr')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leaves.employee_id AND p.manager_id = auth.uid())
  ) WITH CHECK (...);
  ```
* **The Gap:**
  - An employee has full UPDATE rights over their own leave requests without any check constraint on the `status` column.
* **Exploit Vector:**
  - An employee submits a leave request, then immediately executes an update:
    ```json
    {
      "status": "approved",
      "approved_by": "<my-uuid>",
      "approved_at": "2026-10-24T12:00:00Z"
    }
    ```
  - The leave status becomes `approved` without manager or HR intervention.

---

## 3. Logic Not Handled on the Server Side (Client-Only Enforcement)

| Feature / Gate | Current Client-Side Implementation | Database / Server Reality | Risk Level |
| :--- | :--- | :--- | :--- |
| **Geofencing Verification** | Evaluated via Haversine formula in `attendance.functions.ts` inside the browser | No PostGIS or database trigger validating coordinates on `public.attendance` | **Critical** |
| **Liveness & Anti-Spoofing** | Blink detection and eye movement analyzed in `FaceCapture.tsx` client canvas | The database receives a client-provided descriptor; no server-side video/frame validation | **High** |
| **Rate Limiting** | Counted via `enforceAttendanceRateLimit` client query | No PostgreSQL connection-level or Edge Function rate limiting on REST endpoints | **Medium** |
| **Middleware Execution** | Declared via `.middleware([requireAdminAccess])` | In `start-shim.ts`, `middleware: (_mw) => builder` **drops all middlewares completely** | **Critical** |
| **Face Re-enrollment** | `FaceCapture.tsx` calls `enrollFace` | `face_descriptors` RLS has `FOR ALL USING (user_id = auth.uid())`; users can overwrite face descriptors without admin approval | **High** |
| **Audit Logging Integrity** | `logAttendanceBio` and `attendance_attempts` inserted via client | Client has direct INSERT access to `attendance_attempts` and can suppress error logs or forge passes | **Medium** |

---

## 4. Dropped Middlewares in `start-shim.ts`

* **File Location:** [`src/lib/start-shim.ts`](file:///d:/int/int-hr-app2/src/lib/start-shim.ts#L17-L20)
* **The Gap:**
  ```typescript
  export function createServerFn(_opts?: { method?: string }) {
    let validatorFn: ((input: any) => any) | null = null;
    const builder: any = {
      middleware: (_mw: any[]) => builder, // <--- DISCARDED SILENTLY
      validator: (v: any) => { validatorFn = v; return builder; },
      ...
  ```
  - In `start-shim.ts`, the `.middleware(...)` call simply returns the builder without storing or executing any middleware functions.
  - Guards such as `requireAdminAccess`, `requireAdminRole`, or `requireStaffAccess` are **completely ignored** unless the function handler manually runs an explicit role check inside its body.

---

## 5. Defensive Remediation & Action Plan

To establish a secure authorization boundary in this static SPA architecture:

### 1. Lock Down `public.attendance` RLS
- Remove `INSERT` and `UPDATE` permissions from `authenticated` users on `public.attendance`.
- Move check-in/check-out execution to a **Supabase Edge Function** or a PostgreSQL `SECURITY DEFINER` function (e.g. `rpc_check_in(lat, lng, bio_token, device_id)`).
- The RPC must validate geofencing, working days, and consume the biometric token in an atomic database transaction.

### 2. Restrict `public.profiles` Column Updates
- Create a PostgreSQL `BEFORE UPDATE` trigger on `public.profiles` that prohibits non-admin users from altering sensitive columns:
  ```sql
  CREATE OR REPLACE FUNCTION public.protect_profile_fields()
  RETURNS trigger AS $$
  BEGIN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')) THEN
      IF (NEW.role IS DISTINCT FROM OLD.role) OR
         (NEW.status IS DISTINCT FROM OLD.status) OR
         (NEW.face_required IS DISTINCT FROM OLD.face_required) OR
         (NEW.device_check_required IS DISTINCT FROM OLD.device_check_required) OR
         (NEW.approved_work_date IS DISTINCT FROM OLD.approved_work_date) OR
         (NEW.salary_amount IS DISTINCT FROM OLD.salary_amount) THEN
        RAISE EXCEPTION 'Unauthorized column modification on profile';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```

### 3. Secure `biometric_verification_tokens`
- Revoke direct `INSERT` on `public.biometric_verification_tokens` from `authenticated`.
- Tokens must only be generated by a `SECURITY DEFINER` function or Edge Function that validates the biometric match.

### 4. Enforce Device Registration State
- Change the `INSERT` policy on `public.employee_devices` to force `status = 'pending'`:
  ```sql
  DROP POLICY IF EXISTS "Users register own devices" ON public.employee_devices;
  CREATE POLICY "Users register own devices" ON public.employee_devices
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND status = 'pending');
  ```

### 5. Prevent Self-Approval of Leaves
- Restrict `leaves` update policy so that employees can only set `status = 'cancelled'`, while `status = 'approved'` or `'rejected'` requires manager, HR, or admin roles.

### 6. Restore Middleware Execution in `start-shim.ts`
- Update `start-shim.ts` to iterate through all registered middlewares and execute their `.server(...)` hooks sequentially before calling the final function handler.
