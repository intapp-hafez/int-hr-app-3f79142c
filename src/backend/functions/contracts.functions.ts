import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { z } from "zod";

export type ContractRow = {
  id: string;
  emp_code: string | null;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  contract_type: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_cancelled: boolean;
};

export const listContractsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(25),
        q: z.string().max(120).optional().default(""),
        filter: z
          .enum(["all", "15", "30", "45", "60", "90", "expired", "cancelled"])
          .optional()
          .default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<{
    rows: ContractRow[];
    total: number;
    counts: { total: number; expiring30: number; expiring90: number; expired: number };
  }> => {
    const { supabase } = context;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    const plusDaysIso = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };

    const baseSelect =
      "id, emp_code, full_name, avatar_url, contract_type, contract_start_date, contract_end_date, contract_cancelled, departments:department_id(name_en), positions:position_id(name_en)";

    let query = supabase
      .from("profiles")
      .select(baseSelect, { count: "exact" })
      .eq("status", "Active");

    if (data.q) {
      const like = `%${data.q.replace(/[%_]/g, "")}%`;
      query = query.or(`full_name.ilike.${like},emp_code.ilike.${like},email.ilike.${like}`);
    }

    if (data.filter === "cancelled") {
      query = query.eq("contract_cancelled", true);
    } else if (data.filter === "expired") {
      query = query.eq("contract_cancelled", false).lt("contract_end_date", todayIso);
    } else if (data.filter !== "all") {
      const max = Number(data.filter);
      query = query
        .eq("contract_cancelled", false)
        .gte("contract_end_date", todayIso)
        .lte("contract_end_date", plusDaysIso(max));
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    query = query.order("contract_end_date", { ascending: true, nullsFirst: false }).range(from, to);

    const { data: list, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows: ContractRow[] = (list ?? []).map((p: any) => ({
      id: p.id,
      emp_code: p.emp_code ?? null,
      full_name: p.full_name ?? null,
      avatar_url: p.avatar_url ?? null,
      department: p.departments?.name_en ?? null,
      position: p.positions?.name_en ?? null,
      contract_type: p.contract_type ?? null,
      contract_start_date: p.contract_start_date ?? null,
      contract_end_date: p.contract_end_date ?? null,
      contract_cancelled: !!p.contract_cancelled,
    }));

    // Counts (independent of filter/search) for the stat cards.
    const countQ = (build: (q: any) => any) =>
      build(
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "Active"),
      );
    const [{ count: cTotal }, { count: cExp30 }, { count: cExp90 }, { count: cExpired }] =
      await Promise.all([
        countQ((q) => q),
        countQ((q) =>
          q.eq("contract_cancelled", false).gte("contract_end_date", todayIso).lte("contract_end_date", plusDaysIso(30)),
        ),
        countQ((q) =>
          q.eq("contract_cancelled", false).gte("contract_end_date", todayIso).lte("contract_end_date", plusDaysIso(90)),
        ),
        countQ((q) => q.eq("contract_cancelled", false).lt("contract_end_date", todayIso)),
      ]);

    return {
      rows,
      total: count ?? 0,
      counts: {
        total: cTotal ?? 0,
        expiring30: cExp30 ?? 0,
        expiring90: cExp90 ?? 0,
        expired: cExpired ?? 0,
      },
    };
  });

function addMonthsIso(iso: string, months: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const renewContractAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        months: z.number().int().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cur, error: e1 } = await supabase
      .from("profiles")
      .select("contract_start_date, contract_end_date")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    const today = new Date().toISOString().slice(0, 10);
    const baseEnd = (cur as any)?.contract_end_date ?? today;
    const newEnd = addMonthsIso(baseEnd < today ? today : baseEnd, data.months);
    const patch: Record<string, any> = {
      contract_end_date: newEnd,
      contract_cancelled: false,
    };
    if (!(cur as any)?.contract_start_date) patch.contract_start_date = today;
    const { error } = await (supabase.from("profiles") as any).update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await (supabase.from("contract_audit_log") as any).insert({
      profile_id: data.id,
      action: `renew_${data.months}m`,
      previous_end_date: (cur as any)?.contract_end_date ?? null,
      new_end_date: newEnd,
      performed_by: userId,
    });
    return { ok: true, contract_end_date: newEnd };
  });

export const cancelContractAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase
      .from("profiles")
      .select("contract_end_date")
      .eq("id", data.id)
      .single();
    const { error } = await (supabase.from("profiles") as any)
      .update({ contract_cancelled: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await (supabase.from("contract_audit_log") as any).insert({
      profile_id: data.id,
      action: "cancel",
      reason: data.reason ?? null,
      previous_end_date: (cur as any)?.contract_end_date ?? null,
      performed_by: userId,
    });
    return { ok: true, reason: data.reason ?? null };
  });

export const reactivateContractAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase.from("profiles") as any)
      .update({ contract_cancelled: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await (supabase.from("contract_audit_log") as any).insert({
      profile_id: data.id,
      action: "reactivate",
      performed_by: userId,
    });
    return { ok: true };
  });