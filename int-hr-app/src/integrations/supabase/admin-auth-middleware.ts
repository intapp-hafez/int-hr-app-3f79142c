import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

const ADMIN_AREA_ROLES = ["admin", "hr", "manager", "user"] as const;

/**
 * Server-side guard for admin-area server functions.
 *
 * Extends `requireSupabaseAuth`: validates the bearer token, then ensures
 * the user has at least one role granting access to the /admin surface.
 * Mirrors the client check in `src/routes/admin.tsx` so unauthorized users
 * cannot fetch admin data even if the UI is bypassed.
 */
export const requireAdminAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r: { role: string }) => r.role);
    if (!roles.some((r) => (ADMIN_AREA_ROLES as readonly string[]).includes(r))) {
      throw new Error("Forbidden: admin area access required");
    }
    return next({ context: { roles } });
  });

/**
 * Stricter guard: requires the `admin` role specifically.
 * Use on destructive / config-mutating server functions.
 */
export const requireAdminRole = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Forbidden: admin role required");
    return next();
  });

const STAFF_AREA_ROLES = ["admin", "hr", "staff"] as const;

/**
 * Server-side guard for staff-area server functions.
 * Allows admin, hr, or staff role.
 */
export const requireStaffAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r: { role: string }) => r.role);
    if (!roles.some((r) => (STAFF_AREA_ROLES as readonly string[]).includes(r))) {
      throw new Error("Forbidden: staff area access required");
    }
    return next({ context: { roles } });
  });