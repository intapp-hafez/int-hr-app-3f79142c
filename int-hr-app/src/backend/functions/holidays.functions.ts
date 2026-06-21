import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const HolidayInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  type: z.enum(["public", "company", "weekend"]),
  country: z.string().trim().max(80).optional().nullable(),
  recurring: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
export type HolidayInput = z.infer<typeof HolidayInputSchema>;

export type HolidayRow = {
  id: string;
  name: string;
  date: string;
  type: string;
  country: string | null;
  recurring: boolean;
  notes: string | null;
};

export const listHolidays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HolidayRow[]> => {
    const { data, error } = await context.supabase
      .from("holidays")
      .select("id, name, date, type, country, recurring, notes")
      .order("date", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as HolidayRow[];
  });

export type HolidayConflict = {
  leave_id: string;
  employee_name: string;
  leave_type: string | null;
  start_date: string;
  end_date: string;
  status: string;
};

export const upsertHoliday = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => HolidayInputSchema.parse(i))
  .handler(async ({ data, context }): Promise<{ id: string; conflicts: HolidayConflict[] }> => {
    await assertAdmin(context);
    const { supabase, userId } = context;
    const payload = {
      name: data.name,
      date: data.date,
      type: data.type,
      country: data.country ?? null,
      recurring: data.recurring ?? false,
      notes: data.notes ?? null,
    };
    let id = data.id;
    if (id) {
      const { error } = await supabase.from("holidays").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase
        .from("holidays")
        .insert({ ...payload, created_by: userId })
        .select("id").single();
      if (error) throw new Error(error.message);
      id = row.id as string;
    }
    const { data: lv, error: lvErr } = await supabase
      .from("leaves")
      .select("id, leave_type_name, start_date, end_date, status, profiles:employee_id(full_name)")
      .lte("start_date", data.date)
      .gte("end_date", data.date)
      .in("status", ["pending", "approved"])
      .limit(50);
    if (lvErr) throw new Error(lvErr.message);
    const conflicts: HolidayConflict[] = (lv ?? []).map((r: any) => ({
      leave_id: r.id,
      employee_name: r.profiles?.full_name ?? "—",
      leave_type: r.leave_type_name ?? null,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
    }));
    return { id: id!, conflicts };
  });

export const deleteHoliday = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("holidays").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkHolidayConflicts = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      excludeId: z.string().uuid().optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ conflicts: HolidayConflict[]; duplicate: { id: string; name: string } | null }> => {
    await assertAdmin(context);
    const { supabase } = context;
    const [lvRes, dupRes] = await Promise.all([
      supabase
        .from("leaves")
        .select("id, leave_type_name, start_date, end_date, status, profiles:employee_id(full_name)")
        .lte("start_date", data.date)
        .gte("end_date", data.date)
        .in("status", ["pending", "approved"])
        .limit(50),
      supabase.from("holidays").select("id, name").eq("date", data.date).limit(2),
    ]);
    if (lvRes.error) throw new Error(lvRes.error.message);
    if (dupRes.error) throw new Error(dupRes.error.message);
    const conflicts: HolidayConflict[] = (lvRes.data ?? []).map((r: any) => ({
      leave_id: r.id,
      employee_name: r.profiles?.full_name ?? "—",
      leave_type: r.leave_type_name ?? null,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
    }));
    const dup = (dupRes.data ?? []).find((h: any) => h.id !== data.excludeId) ?? null;
    return { conflicts, duplicate: dup ? { id: dup.id, name: dup.name } : null };
  });