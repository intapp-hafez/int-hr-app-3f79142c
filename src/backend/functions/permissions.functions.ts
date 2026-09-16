import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PERMISSION_PAGES = [
  { slug: "employees", label: "Employees", category: "core_hr", path: "/admin/employees", icon: "Users" },
  { slug: "contracts", label: "Contracts", category: "core_hr", path: "/admin/contracts", icon: "FileSignature" },
  { slug: "directory", label: "Directory", category: "core_hr", path: "/admin/directory", icon: "Building2" },
  { slug: "employee-access", label: "Employee Access", category: "core_hr", path: "/admin/employee-access", icon: "KeyRound" },
  { slug: "attendance", label: "Attendance", category: "attendance", path: "/admin/attendance", icon: "Clock" },
  { slug: "leaves", label: "Leaves", category: "attendance", path: "/admin/leaves", icon: "CalendarDays" },
  { slug: "leaves-requests", label: "Leave Requests", category: "attendance", path: "/admin/leaves-requests", icon: "CalendarDays" },
  { slug: "shifts", label: "Shifts", category: "attendance", path: "/admin/shifts", icon: "Clock" },
  { slug: "holidays", label: "Holidays", category: "attendance", path: "/admin/holidays", icon: "CalendarDays" },
  { slug: "holiday-types", label: "Holiday Types", category: "attendance", path: "/admin/holiday-types", icon: "CalendarDays" },
  { slug: "payroll", label: "Payroll", category: "finance", path: "/admin/payroll", icon: "Wallet" },
  { slug: "advances", label: "Advances", category: "finance", path: "/admin/advances", icon: "Banknote" },
  { slug: "allowances", label: "Allowances", category: "finance", path: "/admin/allowances", icon: "Calculator" },
  { slug: "late-penalties", label: "Late Penalties", category: "finance", path: "/admin/late-penalties", icon: "AlertTriangle" },
  { slug: "targets-overtime", label: "Targets / Overtime", category: "finance", path: "/admin/targets-overtime", icon: "TrendingUp" },
  { slug: "kpis", label: "KPIs", category: "finance", path: "/admin/kpis", icon: "BarChart3" },
  { slug: "geofencing", label: "Geofencing", category: "operations", path: "/admin/geofencing", icon: "MapPin" },
  { slug: "networks", label: "Networks & Devices", category: "operations", path: "/admin/networks", icon: "Network" },
  { slug: "reports", label: "Reports", category: "operations", path: "/admin/reports", icon: "FileBarChart2" },
  { slug: "audit", label: "Audit Log", category: "operations", path: "/admin/audit", icon: "ScrollText" },
  { slug: "settings", label: "Settings", category: "settings", path: "/admin/settings", icon: "Settings" },
  { slug: "roles", label: "Roles & Permissions", category: "settings", path: "/admin/settings/roles", icon: "Shield" },
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
  .middleware([requireSupabaseAuth])
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

export type AppPageItem = {
  slug: string;
  label: string;
  label_ar?: string;
  path: string;
  category: string;
  icon?: string;
  description?: string;
};

export const listDynamicAppPages = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<AppPageItem[]> => {
    try {
      const { data, error } = await (context.supabase as any)
        .from("app_pages")
        .select("slug, label, label_ar, path, category, icon, description")
        .order("display_order", { ascending: true });
      if (!error && data && data.length > 0) {
        return data as unknown as AppPageItem[];
      }
    } catch {
      // fallback to static list
    }
    return PERMISSION_PAGES.map((p) => ({
      slug: p.slug,
      label: p.label,
      path: p.path,
      category: p.category,
      icon: p.icon,
    }));
  });

export type UserAllowedPageStatus = {
  slug: string;
  label: string;
  path: string;
  category: string;
  icon?: string;
  isAllowed: boolean;
  source: "role" | "override";
  overrideValue: boolean | null;
  roleValue: boolean;
};

export const getUserAllowedPages = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{
    userId: string;
    isAdmin: boolean;
    role: string | null;
    pages: UserAllowedPageStatus[];
    allowedCount: number;
    totalCount: number;
  }> => {
    await assertCanManage(context);
    const { supabase } = context;
    const { userId } = data;

    // Check roles
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");

    const priority = ["hr", "manager", "user"] as const;
    const myRole = priority.find((r) => roles.includes(r)) ?? null;

    // Fetch overrides and role permissions in parallel
    const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
      myRole
        ? supabase
            .from("role_permissions")
            .select("page, can_view")
            .eq("role", myRole)
        : Promise.resolve({ data: [] }),
      supabase
        .from("user_permission_overrides")
        .select("page, can_view")
        .eq("user_id", userId),
    ]);

    const roleMap = new Map<string, boolean>();
    for (const r of (rolePerms ?? []) as any[]) {
      roleMap.set(r.page, Boolean(r.can_view));
    }

    const overrideMap = new Map<string, boolean | null>();
    for (const o of (overrides ?? []) as any[]) {
      overrideMap.set(o.page, o.can_view !== undefined ? o.can_view : null);
    }

    const pages: UserAllowedPageStatus[] = PERMISSION_PAGES.map((p) => {
      if (isAdmin) {
        return {
          slug: p.slug,
          label: p.label,
          path: p.path,
          category: p.category,
          icon: p.icon,
          isAllowed: true,
          source: "role",
          overrideValue: null,
          roleValue: true,
        };
      }

      const roleVal = roleMap.get(p.slug) ?? false;
      const overrideVal = overrideMap.has(p.slug) ? overrideMap.get(p.slug)! : null;
      const isAllowed = overrideVal !== null ? overrideVal : roleVal;

      return {
        slug: p.slug,
        label: p.label,
        path: p.path,
        category: p.category,
        icon: p.icon,
        isAllowed,
        source: overrideVal !== null ? "override" : "role",
        overrideValue: overrideVal,
        roleValue: roleVal,
      };
    });

    const allowedCount = pages.filter((p) => p.isAllowed).length;
    return {
      userId,
      isAdmin,
      role: myRole,
      pages,
      allowedCount,
      totalCount: pages.length,
    };
  });

export const setUserAllowedPage = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        page: PageSchema,
        allowed: z.union([z.boolean(), z.null()]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { data: existing } = await context.supabase
      .from("user_permission_overrides")
      .select("can_view, can_create, can_edit, can_delete, can_export")
      .eq("user_id", data.userId)
      .eq("page", data.page)
      .maybeSingle();

    const row: Record<string, unknown> = {
      user_id: data.userId,
      page: data.page,
      can_view: data.allowed,
      can_create: existing?.can_create ?? null,
      can_edit: existing?.can_edit ?? null,
      can_delete: existing?.can_delete ?? null,
      can_export: existing?.can_export ?? null,
    };

    const allNull = ["can_view", "can_create", "can_edit", "can_delete", "can_export"].every(
      (k) => row[k] === null || row[k] === undefined,
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

export const bulkSetUserAllowedPages = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["allow_all", "block_all", "reset_all"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { userId, action } = data;

    if (action === "reset_all") {
      // Clear all overrides for this user
      const { error } = await context.supabase
        .from("user_permission_overrides")
        .delete()
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const val = action === "allow_all";
    // Fetch existing overrides
    const { data: existingRows } = await context.supabase
      .from("user_permission_overrides")
      .select("page, can_create, can_edit, can_delete, can_export")
      .eq("user_id", userId);

    const existMap = new Map<string, any>();
    for (const r of existingRows ?? []) existMap.set(r.page, r);

    const rowsToUpsert = PERMISSION_PAGES.map((p) => {
      const ex = existMap.get(p.slug);
      return {
        user_id: userId,
        page: p.slug,
        can_view: val,
        can_create: ex?.can_create ?? (val ? true : false),
        can_edit: ex?.can_edit ?? (val ? true : false),
        can_delete: ex?.can_delete ?? (val ? true : false),
        can_export: ex?.can_export ?? (val ? true : false),
      };
    });

    const { error } = await context.supabase
      .from("user_permission_overrides")
      .upsert(rowsToUpsert as never, { onConflict: "user_id,page" });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const setRoleAllowedPage = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        role: ManageRoleSchema,
        page: PageSchema,
        allowed: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { data: existing } = await context.supabase
      .from("role_permissions")
      .select("can_view, can_create, can_edit, can_delete, can_export")
      .eq("role", data.role)
      .eq("page", data.page)
      .maybeSingle();

    const row: Record<string, unknown> = {
      role: data.role,
      page: data.page,
      can_view: data.allowed,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_delete: existing?.can_delete ?? false,
      can_export: existing?.can_export ?? false,
    };

    const { error } = await context.supabase
      .from("role_permissions")
      .upsert(row as never, { onConflict: "role,page" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });