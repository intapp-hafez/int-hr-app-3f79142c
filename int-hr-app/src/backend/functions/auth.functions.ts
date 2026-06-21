import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum(["admin", "hr", "manager", "employee", "staff", "user"]);

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return { profile, roles: (roles ?? []).map((r) => r.role) };
  });

export type MyProfileDetails = {
  id: string;
  emp_code: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  national_id: string | null;
  department: string | null;
  position: string | null;
  manager: string | null;
  salary_mode: string | null;
  salary_amount: number | null;
  contract_type: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_remaining_days: number | null;
};

export const getMyProfileDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfileDetails | null> => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("profiles")
      .select("id, emp_code, full_name, phone, email, national_id, department_id, position_id, manager_id, salary_mode, salary_gross, salary_net, contract_type, contract_start_date, contract_end_date, contract_cancelled")
      .eq("id", userId)
      .maybeSingle();
    if (!p) return null;
    const [{ data: dept }, { data: pos }, { data: mgr }] = await Promise.all([
      p.department_id
        ? supabase.from("departments").select("name_en").eq("id", p.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
      p.position_id
        ? supabase.from("positions").select("name_en").eq("id", p.position_id).maybeSingle()
        : Promise.resolve({ data: null }),
      p.manager_id
        ? supabase.from("profiles").select("full_name").eq("id", p.manager_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const salaryAmount = p.salary_mode === "net"
      ? (p.salary_net ?? null)
      : (p.salary_gross ?? p.salary_net ?? null);
    let remaining: number | null = null;
    if (p.contract_end_date && !p.contract_cancelled) {
      const end = new Date(p.contract_end_date).getTime();
      const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
      remaining = Math.round((end - today) / 86_400_000);
    }
    return {
      id: p.id,
      emp_code: p.emp_code ?? null,
      full_name: p.full_name ?? null,
      phone: p.phone ?? null,
      email: p.email ?? null,
      national_id: p.national_id ?? null,
      department: (dept as { name_en?: string } | null)?.name_en ?? null,
      position: (pos as { name_en?: string } | null)?.name_en ?? null,
      manager: (mgr as { full_name?: string } | null)?.full_name ?? null,
      salary_mode: p.salary_mode ?? null,
      salary_amount: salaryAmount != null ? Number(salaryAmount) : null,
      contract_type: p.contract_type ?? null,
      contract_start_date: p.contract_start_date ?? null,
      contract_end_date: p.contract_end_date ?? null,
      contract_remaining_days: remaining,
    };
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), role: RoleSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can manage roles");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetIsAdmin } = await context.supabase.rpc("has_role", {
      _user_id: data.user_id,
      _role: "admin",
    });
    if (targetIsAdmin) throw new Error("Cannot modify roles of an admin account");
    const { error } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: data.user_id, role: data.role },
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), role: RoleSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can manage roles");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetIsAdmin } = await context.supabase.rpc("has_role", {
      _user_id: data.user_id,
      _role: "admin",
    });
    if (targetIsAdmin) throw new Error("Cannot modify roles of an admin account");
    const { error } = await supabaseAdmin.from("user_roles")
      .delete().eq("user_id", data.user_id).eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email").order("full_name"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pe) throw new Error(pe.message);
    if (re) throw new Error(re.message);
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });