## Permissions System for /admin/roles

### Model

Two tables, both keyed by `page` (string slug matching admin route, e.g. `employees`, `payroll`, `attendance`) and five action booleans: `can_view`, `can_create`, `can_edit`, `can_delete`, `can_export`.

- `role_permissions(role app_role, page text, can_view, can_create, can_edit, can_delete, can_export)` — PK `(role, page)`. Holds the default matrix for `hr`, `manager`, `user`.
- `user_permission_overrides(user_id uuid, page text, can_view, can_create, can_edit, can_delete, can_export)` — PK `(user_id, page)`. Booleans **nullable**: `NULL` = inherit from role, `true/false` = override.

Effective rule (computed in a SECURITY DEFINER SQL function `public.has_permission(uid, page, action)`):
1. If user has `admin` role → `true`.
2. If user has `employee`/`staff` only (no hr/manager/user) → `false` for all admin pages.
3. Otherwise: take user override if non-null, else role default for the user's highest-privilege admin role (`hr` > `manager` > `user`), else `false`.

### Database migration

- Create both tables with proper GRANTs, RLS, and policies (admins/hr manage; authenticated read own user_permission_overrides + all role_permissions).
- `has_permission` function for enforcement.
- Seed `role_permissions` with sensible defaults: `hr` = full CRUD+export on HR pages (employees, attendance, leaves, payroll, holidays, contracts, kpis, allowances, directory, reports), view-only on settings/networks/geofencing. `manager` = view + edit on attendance/leaves/tasks-style pages. `user` = view-only on directory.

### Server functions (`src/backend/functions/permissions.functions.ts`)

- `listPages()` — static list of admin pages with labels.
- `getRoleMatrix()` — returns full role × page matrix.
- `setRolePermission({ role, page, action, value })` — admin/hr only.
- `getUserOverrides({ userId })` — returns overrides + effective resolved matrix for that user.
- `setUserOverride({ userId, page, action, value })` — value can be `true | false | null` (null clears override).
- `getMyPermissions()` — used by the client to gate UI; returns effective matrix for current user.

Add a `requirePermission(page, action)` middleware factory that wraps `requireSupabaseAuth` and calls `has_permission` RPC, throwing 403 otherwise. Apply it to sensitive mutating server functions across modules (employees, payroll, leaves, etc.).

### UI

Convert `/admin/roles` to a tabbed page using existing shadcn `Tabs`:

- **Users & Roles** tab — current user/role list.
- **Role Permissions** tab — sub-tabs per role (`hr`, `manager`, `user`). Each shows a table: rows = pages, columns = View / Create / Edit / Delete / Export checkboxes. Toggling a checkbox calls `setRolePermission`.
- **User Overrides** tab — searchable user picker → renders a matrix where each cell is a tri-state (Inherit / Allow / Deny). Save per cell calls `setUserOverride`.

Admin-only banner clarifies: "Admin has full access. Employee/Staff cannot access admin pages."

### UI enforcement helper

`src/lib/permissions.tsx`:
- `usePermissions()` hook — `useQuery` over `getMyPermissions`, cached.
- `<Can page="employees" action="create">…</Can>` wrapper that hides children.
- `canPage(page, action)` helper.

Wire `<Can>` around the visible "Add/Edit/Delete/Export" buttons on the main admin pages and filter the admin sidebar menu so a user only sees pages they can `view`.

### Pages enumerated for the matrix

employees, attendance, leaves, leaves-requests, payroll, holidays, holiday-types, contracts, kpis, allowances, late-penalties, targets-overtime, shifts, networks, geofencing, directory, employee-access, audit, reports, settings, roles.

### Out of scope (this iteration)

- Per-record/row-level permission. RLS continues to gate raw data.
- Migrating every single mutation across the app to `requirePermission` — covered for high-value ones (employees, payroll, leaves, holidays, contracts, roles); the rest can be added incrementally and are still protected by existing RLS.
