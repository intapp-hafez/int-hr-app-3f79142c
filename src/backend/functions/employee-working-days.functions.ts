import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

const DaysSchema = z.array(z.number().int().min(0).max(6));
const DatesSchema = z.array(z.number().int().min(1).max(31));

function countMonthOffDays(
  year: number,
  month: number,
  weekdays: number[],
  onDays: number[],
  offDays: number[],
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let offCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const wd = new Date(year, month - 1, d).getDay();
    const isAllowed = onDays.includes(d)
      ? true
      : offDays.includes(d)
      ? false
      : weekdays.includes(wd);
    if (!isAllowed) offCount++;
  }
  return offCount;
}

function checkManagerOffDaysLimit(roles: string[] | undefined, offCount: number) {
  const isManagerOnly =
    Boolean(roles?.includes("manager")) &&
    !roles?.some((r) => ["admin", "hr"].includes(r));
  if (isManagerOnly && offCount > 8) {
    throw new Error(
      `Managers cannot select more than 8 days off per month (selected configuration results in ${offCount} days off).`,
    );
  }
}

export const getEmployeeWorkingDays = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ employee_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("employee_working_days")
      .select("scope, year, month, days")
      .eq("employee_id", data.employee_id);
    if (error) throw new Error(error.message);
    const weekly = (rows ?? []).find((r: any) => r.scope === "weekly");
    const months = (rows ?? [])
      .filter((r: any) => r.scope === "month")
      .map((r: any) => ({ year: r.year as number, month: r.month as number, days: (r.days ?? []) as number[] }));
    const dateOn = (rows ?? [])
      .filter((r: any) => r.scope === "date_on")
      .map((r: any) => ({ year: r.year as number, month: r.month as number, days: (r.days ?? []) as number[] }));
    const dateOff = (rows ?? [])
      .filter((r: any) => r.scope === "date_off")
      .map((r: any) => ({ year: r.year as number, month: r.month as number, days: (r.days ?? []) as number[] }));
    return {
      weekly: (weekly?.days ?? [0, 1, 2, 3, 4]) as number[],
      months,
      dateOn,
      dateOff,
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
    const roles = (context as any).roles as string[] | undefined;
    const isManagerOnly =
      Boolean(roles?.includes("manager")) &&
      !roles?.some((r) => ["admin", "hr"].includes(r));
    const uniqueDays = Array.from(new Set(data.days)).sort();
    if (isManagerOnly && uniqueDays.length < 5) {
      throw new Error(
        "Managers cannot set more than 2 weekly off days (maximum 8 days off per month).",
      );
    }
    const sb = context.supabase as any;
    const { error } = await sb
      .from("employee_working_days")
      .upsert(
        { employee_id: data.employee_id, scope: "weekly", year: null, month: null, days: uniqueDays },
        { onConflict: "employee_id,scope" } as any,
      );
    if (error) {
      // Fallback: manual delete+insert if partial-index upsert isn't honored
      const { error: delErr } = await sb
        .from("employee_working_days")
        .delete()
        .eq("employee_id", data.employee_id)
        .eq("scope", "weekly");
      if (delErr) throw new Error(delErr.message);
      const { error: insErr } = await sb
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
        on_days: DatesSchema.optional(),
        off_days: DatesSchema.optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const roles = (context as any).roles as string[] | undefined;
    const sb = context.supabase as any;
    const uniqueDays = Array.from(new Set(data.days)).sort();

    let onDays = data.on_days ? Array.from(new Set(data.on_days)).sort((a, b) => a - b) : null;
    let offDays = data.off_days
      ? Array.from(new Set(data.off_days.filter((d) => !onDays?.includes(d)))).sort((a, b) => a - b)
      : null;

    if (onDays === null || offDays === null) {
      const { data: existingDates } = await sb
        .from("employee_working_days")
        .select("scope, days")
        .eq("employee_id", data.employee_id)
        .eq("year", data.year)
        .eq("month", data.month)
        .in("scope", ["date_on", "date_off"]);
      if (onDays === null) {
        onDays = (existingDates ?? []).find((r: any) => r.scope === "date_on")?.days ?? [];
      }
      if (offDays === null) {
        offDays = (existingDates ?? []).find((r: any) => r.scope === "date_off")?.days ?? [];
      }
    }

    const offCount = countMonthOffDays(data.year, data.month, uniqueDays, onDays ?? [], offDays ?? []);
    checkManagerOffDaysLimit(roles, offCount);

    const { error: delErr } = await sb
      .from("employee_working_days")
      .delete()
      .eq("employee_id", data.employee_id)
      .eq("scope", "month")
      .eq("year", data.year)
      .eq("month", data.month);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await sb.from("employee_working_days").insert({
      employee_id: data.employee_id,
      scope: "month",
      year: data.year,
      month: data.month,
      days: uniqueDays,
    });
    if (insErr) throw new Error(insErr.message);

    // If per-date overrides were also passed, save them
    if (data.on_days !== undefined || data.off_days !== undefined) {
      for (const scope of ["date_on", "date_off"] as const) {
        const { error: dErr } = await sb
          .from("employee_working_days")
          .delete()
          .eq("employee_id", data.employee_id)
          .eq("scope", scope)
          .eq("year", data.year)
          .eq("month", data.month);
        if (dErr) throw new Error(dErr.message);
      }
      if ((onDays ?? []).length > 0) {
        const { error: oErr } = await sb.from("employee_working_days").insert({
          employee_id: data.employee_id,
          scope: "date_on",
          year: data.year,
          month: data.month,
          days: onDays,
        });
        if (oErr) throw new Error(oErr.message);
      }
      if ((offDays ?? []).length > 0) {
        const { error: fErr } = await sb.from("employee_working_days").insert({
          employee_id: data.employee_id,
          scope: "date_off",
          year: data.year,
          month: data.month,
          days: offDays,
        });
        if (fErr) throw new Error(fErr.message);
      }
    }

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
    const roles = (context as any).roles as string[] | undefined;
    const isManagerOnly =
      Boolean(roles?.includes("manager")) &&
      !roles?.some((r) => ["admin", "hr"].includes(r));
    const sb = context.supabase as any;

    if (isManagerOnly) {
      // Calculate what fallback weekly pattern would produce
      const { data: weeklyRow } = await sb
        .from("employee_working_days")
        .select("days")
        .eq("employee_id", data.employee_id)
        .eq("scope", "weekly")
        .maybeSingle();
      const weeklyDays = (weeklyRow?.days ?? [0, 1, 2, 3, 4]) as number[];
      const offCount = countMonthOffDays(data.year, data.month, weeklyDays, [], []);
      if (offCount > 8) {
        throw new Error(
          `Cannot remove override: default weekly pattern results in ${offCount} days off in this month (limit is 8 for managers).`,
        );
      }
    }

    const { error } = await sb
      .from("employee_working_days")
      .delete()
      .eq("employee_id", data.employee_id)
      .in("scope", ["month", "date_on", "date_off"])
      .eq("year", data.year)
      .eq("month", data.month);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Per-date overrides: forces specific days (day-of-month 1..31) ON or OFF
// for a given (year, month), overriding the weekday-level pattern.
export const setEmployeeWorkingDaysDates = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        employee_id: z.string().uuid(),
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        on_days: DatesSchema,
        off_days: DatesSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const roles = (context as any).roles as string[] | undefined;
    const sb = context.supabase as any;
    const onDays = Array.from(new Set(data.on_days)).sort((a, b) => a - b);
    const offDays = Array.from(new Set(data.off_days.filter((d) => !onDays.includes(d)))).sort((a, b) => a - b);

    // Fetch active weekday pattern for this month to validate total off days
    const { data: monthRow } = await sb
      .from("employee_working_days")
      .select("days")
      .eq("employee_id", data.employee_id)
      .eq("scope", "month")
      .eq("year", data.year)
      .eq("month", data.month)
      .maybeSingle();
    let weekdays = monthRow?.days as number[] | undefined;
    if (!weekdays) {
      const { data: weeklyRow } = await sb
        .from("employee_working_days")
        .select("days")
        .eq("employee_id", data.employee_id)
        .eq("scope", "weekly")
        .maybeSingle();
      weekdays = (weeklyRow?.days ?? [0, 1, 2, 3, 4]) as number[];
    }

    const offCount = countMonthOffDays(data.year, data.month, weekdays, onDays, offDays);
    checkManagerOffDaysLimit(roles, offCount);

    for (const scope of ["date_on", "date_off"] as const) {
      const { error: delErr } = await sb
        .from("employee_working_days")
        .delete()
        .eq("employee_id", data.employee_id)
        .eq("scope", scope)
        .eq("year", data.year)
        .eq("month", data.month);
      if (delErr) throw new Error(delErr.message);
    }
    if (onDays.length > 0) {
      const { error } = await sb.from("employee_working_days").insert({
        employee_id: data.employee_id,
        scope: "date_on",
        year: data.year,
        month: data.month,
        days: onDays,
      });
      if (error) throw new Error(error.message);
    }
    if (offDays.length > 0) {
      const { error } = await sb.from("employee_working_days").insert({
        employee_id: data.employee_id,
        scope: "date_off",
        year: data.year,
        month: data.month,
        days: offDays,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });