import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

export const PERMISSION_PAGES = [
  { slug: "employees", label: "Employees" },
  { slug: "attendance", label: "Attendance" },
  { slug: "leaves", label: "Leaves" },
  { slug: "leaves-requests", label: "Leave Requests" },
  { slug: "payroll", label: "Payroll" },
  { slug: "holidays", label: "Holidays" },
  { slug: "holiday-types", label: "Holiday Types" },
  { slug: "contracts", label: "Contracts" },
  { slug: "kpis", label: "KPIs" },
  { slug: "allowances", label: "Allowances" },
  { slug: "late-penalties", label: "Late Penalties" },
  { slug: "targets-overtime", label: "Targets / Overtime" },
  { slug: "shifts", label: "Shifts" },
  { slug: "networks", label: "Networks" },
  { slug: "geofencing", label: "Geofencing" },
  { slug: "directory", label: "Directory" },
  { slug: "employee-access", label: "Employee Access" },
  { slug: "audit", label: "Audit Log" },
  { slug: "reports", label: "Reports" },
  { slug: "settings", label: "Settings" },
  { slug: "roles", label: "Roles & Permissions" },
] as const;

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "export"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

const ManageRoleSchema = z.enum(["hr", "manager", "user"]);
const ActionSchema = z.enum(PERMISSION_ACTIONS);
const PageSchema = z.string().min(1).max(64);

type RolePerm = {
  role: string;
  page: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
};

type UserOverride = {
  user_id: string;
  page: string;
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
  can_export: boolean | null;
};

async function assertCanManage(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("hr")) {
    throw new Error("Forbidden: admin or HR role required");
  }
}

export const listPages = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async () => PERMISSION_PAGES.map((p) => ({ ...p })));

export const getRoleMatrix = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    await assertCanManage(context);
    const { data, error } = await context.supabase
      .from("role_permissions")
      .select("role, page, can_view, can_create, can_edit, can_delete, can_export");
    if (error) throw new Error(error.message);
    return (data ?? []) as RolePerm[];
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        role: ManageRoleSchema,
        page: PageSchema,
        action: ActionSchema,
        value: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const col = `can_${data.action}`;
    // upsert with default false on missing columns
    const row: Record<string, unknown> = {
      role: data.role,
      page: data.page,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_export: false,
    };
    row[col] = data.value;
    // fetch existing to preserve other columns
    const { data: existing } = await context.supabase
      .from("role_permissions")
      .select("can_view, can_create, can_edit, can_delete, can_export")
      .eq("role", data.role)
      .eq("page", data.page)
      .maybeSingle();
    if (existing) {
      Object.assign(row, existing, { [col]: data.value });
      row.role = data.role;
      row.page = data.page;
    }
    const { error } = await context.supabase
      .from("role_permissions")
      .upsert(row as never, { onConflict: "role,page" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUserOverrides = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { data: rows, error } = await context.supabase
      .from("user_permission_overrides")
      .select("user_id, page, can_view, can_create, can_edit, can_delete, can_export")
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as UserOverride[];
  });

export const setUserOverride = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        page: PageSchema,
        action: ActionSchema,
        value: z.union([z.boolean(), z.null()]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const col = `can_${data.action}`;
    const { data: existing } = await context.supabase
      .from("user_permission_overrides")
      .select("can_view, can_create, can_edit, can_delete, can_export")
      .eq("user_id", data.userId)
      .eq("page", data.page)
      .maybeSingle();
    const row: Record<string, unknown> = {
      user_id: data.userId,
      page: data.page,
      can_view: null,
      can_create: null,
      can_edit: null,
      can_delete: null,
      can_export: null,
      ...(existing ?? {}),
    };
    row[col] = data.value;
    // If all five are null, delete the row
    const allNull = ["can_view", "can_create", "can_edit", "can_delete", "can_export"].every(
      (k) => row[k] === null,
    );
    if (allNull) {
      const { error } = await context.supabase
        .from("user_permission_overrides")
        .delete()
        .eq("user_id", data.userId)
        .eq("page", data.page);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("user_permission_overrides")
        .upsert(row as never, { onConflict: "user_id,page" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export type EffectivePerm = {
  page: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
};

export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; perms: EffectivePerm[] }> => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (roles.includes("admin")) {
      return {
        isAdmin: true,
        perms: PERMISSION_PAGES.map((p) => ({
          page: p.slug,
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
          can_export: true,
        })),
      };
    }
    const priority = ["hr", "manager", "user"] as const;
    const myRole = priority.find((r) => roles.includes(r)) ?? null;
    const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
      myRole
        ? supabase
            .from("role_permissions")
            .select("page, can_view, can_create, can_edit, can_delete, can_export")
            .eq("role", myRole)
        : Promise.resolve({ data: [] as RolePerm[] }),
      supabase
        .from("user_permission_overrides")
        .select("page, can_view, can_create, can_edit, can_delete, can_export")
        .eq("user_id", userId),
    ]);
    const roleMap = new Map<string, RolePerm>();
    for (const r of (rolePerms ?? []) as RolePerm[]) roleMap.set(r.page, r);
    const overrideMap = new Map<string, UserOverride>();
    for (const o of (overrides ?? []) as UserOverride[]) overrideMap.set(o.page, o);
    const perms = PERMISSION_PAGES.map((p) => {
      const r = roleMap.get(p.slug);
      const o = overrideMap.get(p.slug);
      const pick = (k: keyof EffectivePerm) =>
        o && (o as any)[k] !== null && (o as any)[k] !== undefined
          ? Boolean((o as any)[k])
          : Boolean(r ? (r as any)[k] : false);
      return {
        page: p.slug,
        can_view: pick("can_view"),
        can_create: pick("can_create"),
        can_edit: pick("can_edit"),
        can_delete: pick("can_delete"),
        can_export: pick("can_export"),
      };
    });
    return { isAdmin: false, perms };
  });