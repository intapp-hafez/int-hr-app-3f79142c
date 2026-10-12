import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

const Period = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) });
const NOT_SET_UP = "Database update needed: run docs/migrations/057-monthly-trip-allowances.sql";

function dist(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, r = (d: number) => (d * Math.PI) / 180;
  const s = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type MonthlyTripRow = {
  employee_id: string; employee_name: string; days: number;
  checkin_amount: number; trips_amount: number; total: number;
  details: Array<{ date: string; location: string; rate: number }>;
  status: string; saved: boolean;
};

/** Check-in days inside a work location × position rate, plus approved finished trips (employee + manager trips share the trips table). */
async function compute(supabase: any, year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const [prof, att, locs, pols, trips] = await Promise.all([
    supabase.from("profiles").select("id, full_name, position_id, trip_allowance_enabled, status").neq("status", "Inactive").limit(5000),
    supabase.from("attendance").select("employee_id, date, lat, lng").gte("date", from).lt("date", to).not("lat", "is", null).limit(20000),
    supabase.from("geofence_locations").select("id, name, lat, lng, radius_m, active"),
    supabase.from("trip_allowance_policies").select("geofence_location_id, position_id, nightly_rate").not("geofence_location_id", "is", null),
    supabase.from("trips").select("assignee, calculated_allowance").eq("status", "done").eq("allowance_status", "approved").gte("trip_date", from).lt("trip_date", to),
  ]);
  if (prof.error) throw new Error(/trip_allowance_enabled/.test(prof.error.message) ? NOT_SET_UP : prof.error.message);
  if (att.error) throw new Error(att.error.message);
  const fences = (locs.data ?? []).filter((l: any) => l.active !== false && l.lat != null && l.lng != null);
  const rate = new Map<string, number>();
  for (const p of pols.data ?? []) rate.set(`${p.geofence_location_id}:${p.position_id}`, Number(p.nightly_rate) || 0);
  const tripSum = new Map<string, number>();
  for (const t of trips.data ?? []) if (t.assignee) tripSum.set(t.assignee, (tripSum.get(t.assignee) ?? 0) + Number(t.calculated_allowance || 0));
  const attBy = new Map<string, any[]>();
  for (const a of att.data ?? []) { const l = attBy.get(a.employee_id) ?? []; l.push(a); attBy.set(a.employee_id, l); }

  const out: Omit<MonthlyTripRow, "status" | "saved">[] = [];
  for (const p of prof.data ?? []) {
    const enabled = p.trip_allowance_enabled !== false;
    const details: MonthlyTripRow["details"] = [];
    if (enabled && p.position_id) {
      const seen = new Set<string>();
      for (const a of attBy.get(p.id) ?? []) {
        if (seen.has(a.date)) continue;
        let best: any = null, bd = Infinity;
        for (const f of fences) { const d = dist(a.lat, a.lng, f.lat, f.lng); if (d <= (f.radius_m ?? 0) && d < bd) { bd = d; best = f; } }
        const r = best ? rate.get(`${best.id}:${p.position_id}`) : undefined;
        if (best && r != null && r > 0) { seen.add(a.date); details.push({ date: a.date, location: best.name, rate: r }); }
      }
    }
    const checkin = details.reduce((s, d) => s + d.rate, 0);
    const tripsAmt = enabled ? tripSum.get(p.id) ?? 0 : 0;
    if (!checkin && !tripsAmt) continue;
    out.push({ employee_id: p.id, employee_name: p.full_name ?? "—", days: details.length, checkin_amount: checkin, trips_amount: tripsAmt, total: +(checkin + tripsAmt).toFixed(2), details: details.sort((a, b) => a.date.localeCompare(b.date)) });
  }
  return out;
}

export const listMonthlyTripAllowances = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.parse(i))
  .handler(async ({ data, context }): Promise<MonthlyTripRow[]> => {
    const sb = context.supabase as any;
    const saved = await sb.from("monthly_trip_allowances").select("*").eq("year", data.year).eq("month", data.month);
    if (saved.error) throw new Error(/monthly_trip_allowances/.test(saved.error.message) ? NOT_SET_UP : saved.error.message);
    const live = await compute(sb, data.year, data.month);
    const byId = new Map<string, MonthlyTripRow>();
    for (const r of live) byId.set(r.employee_id, { ...r, status: "not saved", saved: false });
    for (const s of saved.data ?? []) {
      // Approved rows are frozen; drafts show the latest live figures until saved again.
      if (s.status === "approved" || !byId.has(s.employee_id)) {
        byId.set(s.employee_id, { employee_id: s.employee_id, employee_name: byId.get(s.employee_id)?.employee_name ?? "—", days: s.days, checkin_amount: Number(s.checkin_amount), trips_amount: Number(s.trips_amount), total: Number(s.total), details: s.details ?? [], status: s.status, saved: true });
      } else byId.set(s.employee_id, { ...byId.get(s.employee_id)!, status: s.status, saved: true });
    }
    return [...byId.values()].sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  });

export const saveMonthlyTripAllowances = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const existing = await sb.from("monthly_trip_allowances").select("employee_id, status").eq("year", data.year).eq("month", data.month);
    if (existing.error) throw new Error(/monthly_trip_allowances/.test(existing.error.message) ? NOT_SET_UP : existing.error.message);
    const approved = new Set((existing.data ?? []).filter((r: any) => r.status === "approved").map((r: any) => r.employee_id));
    const live = await compute(sb, data.year, data.month);
    const rows = live.filter((r) => !approved.has(r.employee_id)).map((r) => ({
      employee_id: r.employee_id, year: data.year, month: data.month, days: r.days,
      checkin_amount: r.checkin_amount, trips_amount: r.trips_amount, total: r.total, details: r.details,
      status: "draft", computed_by: context.userId,
    }));
    if (rows.length) {
      const { error } = await sb.from("monthly_trip_allowances").upsert(rows, { onConflict: "employee_id,year,month" });
      if (error) throw new Error(error.message);
    }
    return { saved: rows.length };
  });

export const setMonthlyTripAllowanceStatus = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.extend({ employee_ids: z.array(z.string().uuid()).min(1), status: z.enum(["draft", "approved"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("monthly_trip_allowances").update({ status: data.status })
      .eq("year", data.year).eq("month", data.month).in("employee_id", data.employee_ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
