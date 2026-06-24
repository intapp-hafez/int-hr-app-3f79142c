import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

const DaysSchema = z.array(z.number().int().min(0).max(6));

export const getEmployeeWorkingDays = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ employee_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("employee_working_days")
      .select("scope, year, month, days")
      .eq("employee_id", data.employee_id);
    if (error) throw new Error(error.message);
    const weekly = (rows ?? []).find((r: any) => r.scope === "weekly");
    const months = (rows ?? [])
      .filter((r: any) => r.scope === "month")
      .map((r: any) => ({ year: r.year as number, month: r.month as number, days: (r.days ?? []) as number[] }));
    return {
      weekly: (weekly?.days ?? [0, 1, 2, 3, 4]) as number[],
      months,
    };
  });

export const setEmployeeWorkingDaysWeekly = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({ employee_id: z.string().uuid(), days: DaysSchema })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const uniqueDays = Array.from(new Set(data.days)).sort();
    const { error } = await context.supabase
      .from("employee_working_days")
      .upsert(
        { employee_id: data.employee_id, scope: "weekly", year: null, month: null, days: uniqueDays },
        { onConflict: "employee_id,scope" } as any,
      );
    if (error) {
      // Fallback: manual delete+insert if partial-index upsert isn't honored
      const { error: delErr } = await context.supabase
        .from("employee_working_days")
        .delete()
        .eq("employee_id", data.employee_id)
        .eq("scope", "weekly");
      if (delErr) throw new Error(delErr.message);
      const { error: insErr } = await context.supabase
        .from("employee_working_days")
        .insert({ employee_id: data.employee_id, scope: "weekly", days: uniqueDays });
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

export const setEmployeeWorkingDaysMonth = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        employee_id: z.string().uuid(),
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        days: DaysSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const uniqueDays = Array.from(new Set(data.days)).sort();
    const { error: delErr } = await context.supabase
      .from("employee_working_days")
      .delete()
      .eq("employee_id", data.employee_id)
      .eq("scope", "month")
      .eq("year", data.year)
      .eq("month", data.month);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await context.supabase.from("employee_working_days").insert({
      employee_id: data.employee_id,
      scope: "month",
      year: data.year,
      month: data.month,
      days: uniqueDays,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

export const clearEmployeeWorkingDaysMonth = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        employee_id: z.string().uuid(),
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employee_working_days")
      .delete()
      .eq("employee_id", data.employee_id)
      .eq("scope", "month")
      .eq("year", data.year)
      .eq("month", data.month);
    if (error) throw new Error(error.message);
    return { ok: true };
  });