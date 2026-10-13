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
  trip_details: Array<{ date: string; destination: string; amount: number; by_manager: boolean }>;
  manager_trips_amount: number;
  status: string; saved: boolean;
};

/** Check-in days inside a work location × position rate, plus approved finished trips (employee + manager trips share the trips table). */
async function compute(supabase: any, year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const [prof, att, locs, pols, trips] = await Promise.all([
    supabase.from("profiles").select("id, full_name, position_id, manager_id, trip_allowance_enabled, status").neq("status", "Inactive").limit(5000),
    supabase.from("attendance").select("employee_id, date, lat, lng").gte("date", from).lt("date", to).not("lat", "is", null).limit(20000),
    supabase.from("geofence_locations").select("id, name, lat, lng, radius_m, active"),
    supabase.from("trip_allowance_policies").select("geofence_location_id, position_id, nightly_rate").not("geofence_location_id", "is", null),
    supabase.from("trips").select("assignee, created_by, destination, trip_date, calculated_allowance, allowance_status").eq("status", "done").neq("allowance_status", "rejected").gte("trip_date", from).lt("trip_date", to),
  ]);
  if (prof.error) throw new Error(/trip_allowance_enabled/.test(prof.error.message) ? NOT_SET_UP : prof.error.message);
  if (att.error) throw new Error(att.error.message);
  const fences = (locs.data ?? []).filter((l: any) => l.active !== false && l.lat != null && l.lng != null);
  const rate = new Map<string, number>();
  for (const p of pols.data ?? []) rate.set(`${p.geofence_location_id}:${p.position_id}`, Number(p.nightly_rate) || 0);
  // Finished trips — employee and manager-created trips share the trips table, so both are counted automatically.
  const tripsBy = new Map<string, MonthlyTripRow["trip_details"]>();
  for (const t of trips.data ?? []) {
    if (!t.assignee) continue;
    const amt = Number(t.calculated_allowance || 0);
    if (!amt) continue;
    const l = tripsBy.get(t.assignee) ?? [];
    l.push({ date: t.trip_date, destination: t.destination ?? "—", amount: amt, by_manager: !!t.created_by && t.created_by !== t.assignee });
    tripsBy.set(t.assignee, l);
  }
  const attBy = new Map<string, any[]>();
  for (const a of att.data ?? []) { const l = attBy.get(a.employee_id) ?? []; l.push(a); attBy.set(a.employee_id, l); }

  const out: (Omit<MonthlyTripRow, "status" | "saved"> & { manager_id: string | null })[] = [];
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
    const tl = enabled ? (tripsBy.get(p.id) ?? []).sort((a, b) => a.date.localeCompare(b.date)) : [];
    const tripsAmt = tl.reduce((s, t) => s + t.amount, 0);
    const mgrAmt = tl.filter((t) => t.by_manager).reduce((s, t) => s + t.amount, 0);
    if (!checkin && !tripsAmt) continue;
    out.push({ employee_id: p.id, employee_name: p.full_name ?? "—", manager_id: p.manager_id ?? null, days: details.length, checkin_amount: checkin, trips_amount: tripsAmt, manager_trips_amount: mgrAmt, trip_details: tl, total: +(checkin + tripsAmt).toFixed(2), details: details.sort((a, b) => a.date.localeCompare(b.date)) });
  }
  return out;
}

const FINAL_ROLES = ["admin", "hr", "finance"];
const isFinal = (roles: string[]) => roles.some((r) => FINAL_ROLES.includes(r));
const tableErr = (e: any) => new Error(/monthly_trip_allowances|payroll_payments|trip_details|manager_approved/.test(e.message) ? "Database update needed: run docs/migrations/057 and 058 in the Supabase SQL editor" : e.message);

export const listMonthlyTripAllowances = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.parse(i))
  .handler(async ({ data, context }): Promise<{ rows: MonthlyTripRow[]; canFinal: boolean }> => {
    const sb = context.supabase as any;
    const roles = (context as any).roles as string[];
    const saved = await sb.from("monthly_trip_allowances").select("*").eq("year", data.year).eq("month", data.month);
    if (saved.error) throw tableErr(saved.error);
    let live = await compute(sb, data.year, data.month);
    if (!isFinal(roles)) live = live.filter((r) => r.manager_id === context.userId);
    const byId = new Map<string, MonthlyTripRow>();
    for (const { manager_id: _m, ...r } of live) byId.set(r.employee_id, { ...r, status: "not saved", saved: false });
    for (const s of saved.data ?? []) {
      if (!isFinal(roles) && !byId.has(s.employee_id) && s.status === "draft") continue;
      // Approved / manager-approved rows are frozen; drafts show the latest live figures until saved again.
      if (s.status !== "draft" || !byId.has(s.employee_id)) {
        byId.set(s.employee_id, { employee_id: s.employee_id, employee_name: byId.get(s.employee_id)?.employee_name ?? "—", days: s.days, checkin_amount: Number(s.checkin_amount), trips_amount: Number(s.trips_amount), manager_trips_amount: Number(s.manager_trips_amount ?? 0), total: Number(s.total), details: s.details ?? [], trip_details: s.trip_details ?? [], status: s.status, saved: true });
      } else byId.set(s.employee_id, { ...byId.get(s.employee_id)!, status: s.status, saved: true });
    }
    return { rows: [...byId.values()].sort((a, b) => a.employee_name.localeCompare(b.employee_name)), canFinal: isFinal(roles) };
  });

export const saveMonthlyTripAllowances = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.parse(i))
  .handler(async ({ data, context }) => {
    if (!isFinal((context as any).roles)) throw new Error("Only HR, finance or admin can calculate allowances");
    const sb = context.supabase as any;
    const existing = await sb.from("monthly_trip_allowances").select("employee_id, status").eq("year", data.year).eq("month", data.month);
    if (existing.error) throw tableErr(existing.error);
    const frozen = new Set((existing.data ?? []).filter((r: any) => r.status !== "draft").map((r: any) => r.employee_id));
    const live = await compute(sb, data.year, data.month);
    const rows = live.filter((r) => !frozen.has(r.employee_id)).map((r) => ({
      employee_id: r.employee_id, year: data.year, month: data.month, days: r.days,
      checkin_amount: r.checkin_amount, trips_amount: r.trips_amount, manager_trips_amount: r.manager_trips_amount,
      total: r.total, details: r.details, trip_details: r.trip_details,
      status: "draft", computed_by: context.userId,
    }));
    if (rows.length) {
      const { error } = await sb.from("monthly_trip_allowances").upsert(rows, { onConflict: "employee_id,year,month" });
      if (error) throw tableErr(error);
    }
    return { saved: rows.length };
  });

/** draft → manager_approved (employee's manager) → approved (HR/finance/admin). Reopen returns to draft. */
export const setMonthlyTripAllowanceStatus = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.extend({ employee_ids: z.array(z.string().uuid()).min(1), status: z.enum(["draft", "manager_approved", "approved"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const final = isFinal((context as any).roles);
    const [cur, profs, paid] = await Promise.all([
      sb.from("monthly_trip_allowances").select("employee_id, status").eq("year", data.year).eq("month", data.month).in("employee_id", data.employee_ids),
      sb.from("profiles").select("id, manager_id").in("id", data.employee_ids),
      sb.from("payroll_payments").select("employee_id").eq("year", data.year).eq("month", data.month).eq("status", "paid").in("employee_id", data.employee_ids),
    ]);
    if (cur.error) throw tableErr(cur.error);
    const mgr = new Map((profs.data ?? []).map((p: any) => [p.id, p.manager_id]));
    const paidSet = new Set((paid.data ?? []).map((p: any) => p.employee_id));
    const now = new Date().toISOString();
    const ok: string[] = [];
    for (const r of cur.data ?? []) {
      if (paidSet.has(r.employee_id)) continue; // paid months are locked
      const isMgr = mgr.get(r.employee_id) === context.userId;
      if (data.status === "manager_approved" && r.status === "draft" && (isMgr || final)) ok.push(r.employee_id);
      else if (data.status === "approved" && final && (r.status === "manager_approved" || !mgr.get(r.employee_id))) ok.push(r.employee_id);
      else if (data.status === "draft" && (final || (isMgr && r.status === "manager_approved"))) ok.push(r.employee_id);
    }
    if (!ok.length) throw new Error("Nothing to update — rows need the previous approval step first (or are already paid)");
    const patch: any = { status: data.status };
    if (data.status === "manager_approved") Object.assign(patch, { manager_approved_by: context.userId, manager_approved_at: now });
    if (data.status === "approved") Object.assign(patch, { approved_by: context.userId, approved_at: now });
    if (data.status === "draft") Object.assign(patch, { manager_approved_by: null, manager_approved_at: null, approved_by: null, approved_at: null });
    const { error } = await sb.from("monthly_trip_allowances").update(patch).eq("year", data.year).eq("month", data.month).in("employee_id", ok);
    if (error) throw tableErr(error);
    return { updated: ok.length, skipped: data.employee_ids.length - ok.length };
  });

// ---------------- Payroll payments ----------------
export type PaymentRow = {
  employee_id: string; employee_name: string; trip_allowance: number; trip_status: string;
  other_earnings: number; total: number; status: "pending" | "approved" | "paid";
  method: string | null; reference: string | null; paid_at: string | null;
};

export const listPayrollPayments = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.parse(i))
  .handler(async ({ data, context }): Promise<PaymentRow[]> => {
    if (!isFinal((context as any).roles)) throw new Error("Only HR, finance or admin can view payments");
    const sb = context.supabase as any;
    const [mta, run, pays] = await Promise.all([
      sb.from("monthly_trip_allowances").select("employee_id, total, status").eq("year", data.year).eq("month", data.month),
      sb.from("payroll_runs").select("id").eq("year", data.year).eq("month", data.month).order("created_at", { ascending: false }).limit(1),
      sb.from("payroll_payments").select("*").eq("year", data.year).eq("month", data.month),
    ]);
    if (mta.error) throw tableErr(mta.error);
    if (pays.error) throw tableErr(pays.error);
    const runId = run.data?.[0]?.id;
    const items = runId ? (await sb.from("payroll_run_items").select("employee_id, employee_name, net_pay").eq("run_id", runId)).data ?? [] : [];
    const map = new Map<string, PaymentRow>();
    const get = (id: string) => map.get(id) ?? { employee_id: id, employee_name: "—", trip_allowance: 0, trip_status: "—", other_earnings: 0, total: 0, status: "pending" as const, method: null, reference: null, paid_at: null };
    for (const it of items) { const r = get(it.employee_id); r.employee_name = it.employee_name ?? r.employee_name; r.other_earnings = Number(it.net_pay || 0); map.set(it.employee_id, r); }
    for (const m of mta.data ?? []) { const r = get(m.employee_id); r.trip_status = m.status; r.trip_allowance = m.status === "approved" ? Number(m.total) : 0; map.set(m.employee_id, r); }
    for (const p of pays.data ?? []) {
      if (p.status === "cancelled") continue;
      const r = get(p.employee_id);
      Object.assign(r, { status: p.status, method: p.method, reference: p.reference, paid_at: p.paid_at });
      if (p.status === "paid") { r.trip_allowance = Number(p.trip_allowance); r.other_earnings = Number(p.other_earnings); }
      map.set(p.employee_id, r);
    }
    const missing = [...map.values()].filter((r) => r.employee_name === "—").map((r) => r.employee_id);
    if (missing.length) {
      const { data: ps } = await sb.from("profiles").select("id, full_name").in("id", missing);
      for (const p of ps ?? []) map.get(p.id)!.employee_name = p.full_name ?? "—";
    }
    return [...map.values()].map((r) => ({ ...r, total: +(r.trip_allowance + r.other_earnings).toFixed(2) }))
      .filter((r) => r.total > 0 || r.status !== "pending").sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  });

export const approvePayrollPayments = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.extend({ employee_ids: z.array(z.string().uuid()).min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!isFinal((context as any).roles)) throw new Error("Only HR, finance or admin can approve payments");
    const sb = context.supabase as any;
    const [mta, pays] = await Promise.all([
      sb.from("monthly_trip_allowances").select("employee_id, total, status").eq("year", data.year).eq("month", data.month).in("employee_id", data.employee_ids),
      sb.from("payroll_payments").select("employee_id, status").eq("year", data.year).eq("month", data.month).in("employee_id", data.employee_ids),
    ]);
    if (pays.error) throw tableErr(pays.error);
    const paid = new Set((pays.data ?? []).filter((p: any) => p.status === "paid").map((p: any) => p.employee_id));
    const run = await sb.from("payroll_runs").select("id").eq("year", data.year).eq("month", data.month).order("created_at", { ascending: false }).limit(1);
    const runId = run.data?.[0]?.id;
    const items = runId ? (await sb.from("payroll_run_items").select("employee_id, net_pay").eq("run_id", runId).in("employee_id", data.employee_ids)).data ?? [] : [];
    const other = new Map(items.map((i: any) => [i.employee_id, Number(i.net_pay || 0)]));
    const trip = new Map((mta.data ?? []).filter((m: any) => m.status === "approved").map((m: any) => [m.employee_id, Number(m.total)]));
    const now = new Date().toISOString();
    const up = data.employee_ids.filter((id) => !paid.has(id)).map((id) => {
      const t = (trip.get(id) as number) ?? 0, o = (other.get(id) as number) ?? 0;
      return { employee_id: id, year: data.year, month: data.month, trip_allowance: t, other_earnings: o, total: +(t + o).toFixed(2), status: "approved", approved_by: context.userId, approved_at: now };
    });
    if (!up.length) throw new Error("These employees are already paid");
    const { error } = await sb.from("payroll_payments").upsert(up, { onConflict: "employee_id,year,month" });
    if (error) throw tableErr(error);
    return { approved: up.length };
  });

export const markPayrollPaid = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Period.extend({ employee_ids: z.array(z.string().uuid()).min(1), method: z.string().trim().min(1).max(50), reference: z.string().trim().max(120).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    if (!isFinal((context as any).roles)) throw new Error("Only HR, finance or admin can mark payments paid");
    const { data: upd, error } = await (context.supabase as any).from("payroll_payments")
      .update({ status: "paid", method: data.method, reference: data.reference || null, paid_by: context.userId, paid_at: new Date().toISOString() })
      .eq("year", data.year).eq("month", data.month).eq("status", "approved").in("employee_id", data.employee_ids).select("id");
    if (error) throw tableErr(error);
    if (!upd?.length) throw new Error("Approve the payment first");
    return { paid: upd.length };
  });

export const listPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    if (!isFinal((context as any).roles)) throw new Error("Only HR, finance or admin can view payment history");
    const sb = context.supabase as any;
    const { data, error } = await sb.from("payroll_payments").select("id, employee_id, year, month, trip_allowance, other_earnings, total, method, reference, paid_at").eq("status", "paid").order("paid_at", { ascending: false }).limit(500);
    if (error) throw tableErr(error);
    const ids = [...new Set((data ?? []).map((d: any) => d.employee_id))];
    const names = new Map<string, string>();
    if (ids.length) for (const p of (await sb.from("profiles").select("id, full_name").in("id", ids)).data ?? []) names.set(p.id, p.full_name);
    return (data ?? []).map((d: any) => ({ ...d, employee_name: names.get(d.employee_id) ?? "—", trip_allowance: Number(d.trip_allowance), other_earnings: Number(d.other_earnings), total: Number(d.total) }));
  });
