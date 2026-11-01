# Toast & Error Messaging Gaps Report

**Scope:** UI Notifications, Generic Error Masking, Raw Database Error Leaks, and Internationalization Deficiencies  
**Target Repository:** `int-hr-app2` & `android-integration-package`  
**Date:** 2026-10-24  

---

## Executive Summary

An audit of UI feedback across the codebase revealed severe deficiencies in how errors and notifications are presented to users. Over **400 calls** to `toast.error()` exhibit three primary anti-patterns:

1. **Blanket Error Masking:** Replacing all distinct business, policy, and hardware failures with the static Arabic sentence:  
   > **`"تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة."`**  
   *(Could not complete the operation at this time. Please contact management.)*  
   This hides actionable causes (e.g. today is a weekend, GPS timed out, device unapproved, face not verified, already checked in).
2. **Raw Technical Leaks (`e?.message`):** Exposing unformatted Postgres database constraints, RLS policy violations, and PostgREST schema errors directly to end users.
3. **Hardcoded English Fallbacks (`?? "Failed"`):** Displaying abrupt, untranslated English strings even when the user is operating in Arabic mode (`isAr = true`).
4. **Orphaned I18n Infrastructure:** Existing translation functions (such as `formatBlocked()` in `src/lib/i18n/index.tsx`) designed specifically to explain block reasons in Arabic and English are imported but completely ignored in the UI.

---

## 1. The Blanket Masking Pattern: `"تعذر إتمام العملية حاليًا..."`

In the attendance and biometric modules, the generic message `"تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة."` is used indiscriminately across **11 separate code locations**, swallowing vastly different failure modes:

| File | Line | Actual Root Cause Concealed | What the User Should See |
| :--- | :--- | :--- | :--- |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L142) | 142 | Browser does not support Geolocation API | *"Browser does not support location services"* / *"المتصفح لا يدعم تحديد الموقع"* |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L278) | 278 | User is physically outside their assigned geofence | *"You are outside your assigned work area"* / *"أنت خارج نطاق موقع العمل المحدد"* |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L294) | 294 | GPS acquisition timed out or permission denied | *"Location permission denied or timed out"* / *"تم رفض إذن الموقع أو انتهت مهلة البحث"* |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L302) | 302 | Dynamic GPS re-check determined user is outside fence | *"Outside fence boundary"* / *"خارج حدود موقع العمل"* |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L339) | 339 | Backend rejected check-in (`weekend`, `holiday`, `leave`, `already_checked_in`, `rate_limit`) | **Actionable specific reason** (e.g., *"Today is a weekend"* / *"اليوم عطلة نهاية الأسبوع"*) |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L353) | 353 | Backend rejected check-out (`not_checked_in`, `already_checked_out`, `active_task`) | **Actionable specific reason** (e.g., *"You have not checked in today"*) |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L371) | 371 | Network drop, server timeout, or 500 error | *"Network connection failed. Please retry"* / *"فشل الاتصال بالخادم، يرجى إعادة المحاولة"* |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L389) | 389 | Fingerprint / WebAuthn validation failure | *"Fingerprint verification failed"* / *"فشل التحقق من البصمة"* |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L415) | 415 | Face recognition descriptor mismatch | *"Face did not match enrolled profile"* / *"بصمة الوجه غير مطابقة للملف المسجل"* |
| [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L418) | 418 | Camera initialization failure or face model load crash | *"Unable to access camera or load models"* / *"تعذر تشغيل الكاميرا أو تحميل النماذج"* |
| [`src/routes/manager.check.tsx`](file:///d:/int/int-hr-app2/src/routes/manager.check.tsx#L230) | 230 | Manager check-in blocked by policy | Dynamic block message via `formatBlocked(res)` |
| [`src/routes/manager.check.tsx`](file:///d:/int/int-hr-app2/src/routes/manager.check.tsx#L237) | 237 | Manager check-out blocked by policy | Dynamic block message via `formatBlocked(res)` |

### User Experience Impact:
When an employee tries to check in on a Saturday, they see:
> 🔴 `"تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة."`

They assume the application is broken or the server is down, prompting unnecessary support tickets to HR/IT, when in reality the system simply prevented check-in because of a weekend policy.

---

## 2. Disconnected & Orphaned I18n Infrastructure

The application **already contains** a dedicated, well-crafted translation helper designed to solve this exact problem:

* **File Location:** [`src/lib/i18n/index.tsx`](file:///d:/int/int-hr-app2/src/lib/i18n/index.tsx#L62-L95)
```typescript
const formatBlocked: Ctx["formatBlocked"] = (blocked) => {
  const code = blocked?.code;
  const p = blocked?.params ?? {};
  const actionKey: UiKey = p.action === "check_out" ? "actionCheckOut" : "actionCheckIn";
  const action = t(actionKey);
  switch (code) {
    case "check_in_already": return t("blockedCheckInAlready");
    case "check_out_already": return t("blockedCheckOutAlready");
    case "check_out_not_in": return t("blockedCheckOutNotIn");
    case "leave": return tf("blockedLeave", { action, name: String(p.name ?? ""), range: String(p.range ?? "") });
    case "leave_noname": return tf("blockedLeaveNoName", { action, range: String(p.range) });
    case "holiday": return tf("blockedHoliday", { action, name: String(p.name ?? "") });
    case "weekend": return tf("blockedWeekend", { action });
    case "constraints": return tf("blockedConstraints", { action, reasons: ... });
    ...
```

* **The Disconnect:**
  In [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx#L48):
  ```typescript
  const { t, tf, formatBlocked } = useI18n(); // <--- IMPORTED HERE
  ```
  Yet on line 339 and line 353:
  ```typescript
  if (res?.blocked) {
    toast.error("تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة.", { id: toastId }); // <--- HARDCODED STATIC STRING!
    return;
  }
  ```
  `formatBlocked(res)` is completely bypassed.

---

## 3. Raw Database & Technical Errors Leaked to End Users

In over **120 locations**, mutations catch errors and pass `e?.message` directly to `toast.error()`:

```typescript
onError: (e: any) => toast.error(e?.message ?? "Failed to save")
```

### Problematic Examples:
1. **Database Constraint Violations:**
   - When an employee code or national ID already exists:  
     Toast shows: `duplicate key value violates unique constraint "profiles_emp_code_unique"`
   - What the user should see:  
     *"This Employee Code is already in use by another profile."* / *"كود الموظف هذا مستخدم بالفعل."*

2. **Row-Level Security (RLS) Violations:**
   - When an unauthorized role tries to update a table:  
     Toast shows: `new row violates row-level security policy for table "shifts"`
   - What the user should see:  
     *"You do not have permission to modify shifts."* / *"ليس لديك الصلاحية لتعديل الورديات."*

3. **Not-Null Database Failures:**
   - When a required form field is missed:  
     Toast shows: `null value in column "national_id" violates not-null constraint`
   - What the user should see:  
     *"National ID is required."* / *"الرقم القومي مطلوب."*

4. **PostgREST Query Structure Errors:**
   - When a record is deleted by another admin during viewing:  
     Toast shows: `JSON object requested, multiple (or no) rows returned`
   - What the user should see:  
     *"The requested record could not be found."* / *"السجل المطلوب غير موجود."*

---

## 4. Hardcoded English Fallbacks in Arabic Interface

Throughout administrative and manager views, fallback strings default to English without checking `isAr`:

### Representative Occurrences:
* **`manager.trips.tsx` (lines 95, 99, 366):**
  ```typescript
  catch (e: any) { toast.error(e?.message ?? "Failed"); }
  toast.error(e?.message ?? "Failed to save trip");
  ```
* **`manager.tasks.tsx` (lines 85, 89, 93, 1097):**
  ```typescript
  catch (e: any) { toast.error(e?.message ?? "Failed"); }
  toast.error(e?.message || "Failed to create task");
  ```
* **`manager.profile.tsx` & `finance.profile.tsx` (lines 78, 86, 721–730):**
  ```typescript
  if (next !== conf) { toast.error("Passwords do not match"); return; }
  else if (res === "wrong-current") toast.error("Current password is incorrect");
  else if (res === "too-short") toast.error("Password is too short");
  else toast.error("Failed to change password");
  ```
* **`admin.work-locations.tsx` (lines 51, 57):**
  ```typescript
  onError: (e: any) => toast.error(e?.message ?? "Failed to save")
  onError: (e: any) => toast.error(e?.message ?? "Failed to remove")
  ```
* **`admin.shifts.tsx` (lines 90, 100, 153):**
  ```typescript
  onError: (e: any) => toast.error(e?.message ?? "Failed")
  toast.error(err?.message ?? "Failed to download template")
  ```
* **`finance.payroll.tsx` (lines 89, 97):**
  ```typescript
  onError: (e: any) => toast.error(e?.message ?? "Failed to lock payroll")
  ```

---

## 5. Inconsistent Toast Identification (`{ id: toastId }`)

When performing asynchronous server operations, best practice is to update a loading toast into a success or error toast using `{ id: toastId }`.

* **The Inconsistency:**
  - In `employee.check.tsx`:
    - `const toastId = toast.loading("جاري الاتصال بالسيرفر، برجاء الانتظار...");`
    - Line 339 updates it correctly: `toast.error(..., { id: toastId })`.
    - BUT in line 278: `toast.error("تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة.")` (without `toastId`), leaving the loading spinner hanging indefinitely!
    - Lines 389, 415, and 418 also do not dismiss or update pending toast spinners.

---

## 6. Actionable Remediation Plan

### Step 1: Connect `formatBlocked` to All Attendance Views
In both `src/routes/employee.check.tsx` and `src/routes/manager.check.tsx`, replace the generic Arabic strings:
```diff
- if (res?.blocked) {
-   toast.error("تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة.", { id: toastId });
-   return;
- }
+ if (res?.blocked) {
+   toast.error(formatBlocked(res) || (isAr ? "تعذر إتمام العملية حاليًا." : "Check-in blocked."), { id: toastId });
+   return;
+ }
```

### Step 2: Implement a Centralized Error Sanitizer (`formatAppError`)
Create a utility function `src/lib/error-formatter.ts`:
```typescript
export function formatAppError(err: unknown, isAr: boolean): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");

  // Unique constraint
  if (msg.includes("profiles_emp_code_unique")) {
    return isAr ? "كود الموظف هذا مستخدم بالفعل." : "This employee code is already in use.";
  }
  if (msg.includes("profiles_national_id_key") || msg.includes("national_id")) {
    return isAr ? "الرقم القومي مستخدم بالفعل أو غير صالح." : "National ID is invalid or already registered.";
  }

  // RLS / Authorization
  if (msg.includes("row-level security") || msg.includes("Forbidden") || msg.includes("PGRST301")) {
    return isAr ? "ليس لديك الصلاحية الكافية لإتمام هذا الإجراء." : "You do not have permission to perform this action.";
  }

  // Fallbacks
  return msg || (isAr ? "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى." : "An unexpected error occurred. Please try again.");
}
```

### Step 3: Localize Password & Profile Validation Toasts
Update `ChangeAccountPassword.tsx`, `manager.profile.tsx`, and `finance.profile.tsx` to read error messages from `t("passwordMismatch")`, `t("passwordTooShort")`, and `t("wrongCurrentPassword")` instead of hardcoded English literals.
