import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AttendanceCheckSchema, AdminAttendanceSchema } from "../schemas";

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Haversine distance in meters between two lat/lng points
function distMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const checkIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AttendanceCheckSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const dow = new Date(today + "T00:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
    const isWeekend = dow === 5 || dow === 6; // Fri / Sat

    // Resolve assigned geofences + per-employee authorized networks + branch-level networks
    const [{ data: assigns }, { data: netAssigns }, { data: leaveRow }, { data: holidayRow }] = await Promise.all([
      supabase
        .from("geofence_assignments")
        .select("geofence_locations(id, name, lat, lng, radius_m, active)")
        .eq("profile_id", userId) as any,
      supabase
        .from("network_assignments")
        .select("networks(id, name, ssid, bssid, is_active)")
        .eq("profile_id", userId) as any,
      supabase
        .from("leaves")
        .select("id, leave_type_name, status, start_date, end_date")
        .eq("employee_id", userId)
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle() as any,
      supabase
        .from("holidays")
        .select("name, type")
        .eq("date", today)
        .maybeSingle() as any,
    ]);

    // 1. Approved leave
    if (leaveRow) {
      throw new Error(`Check-in blocked · on approved leave today (${leaveRow.leave_type_name ?? "Leave"}).`);
    }
    // 2. Holiday
    if (holidayRow) {
      throw new Error(`Check-in blocked · today is a holiday (${holidayRow.name}).`);
    }
    // 3. Weekend (Fri/Sat)
    if (isWeekend) {
      throw new Error("Check-in blocked · today is a weekend (Friday / Saturday).");
    }

    const locs = (assigns ?? [])
      .map((a: any) => a.geofence_locations)
      .filter((l: any) => l && l.active);

    const nets = ((netAssigns ?? []) as any[])
      .map((a) => a.networks)
      .filter((n: any) => n && n.is_active);

    const hasConstraints = locs.length > 0 || nets.length > 0;
    const freeCheck = !hasConstraints;

    let withinGeofence = false;
    let nearestDistance: number | null = null;
    let nearestRadius = 0;
    if (locs.length > 0 && data.lat != null && data.lng != null) {
      for (const l of locs as any[]) {
        const d = distMeters(data.lat!, data.lng!, Number(l.lat), Number(l.lng));
        const r = Number(l.radius_m ?? 100);
        if (nearestDistance == null || d < nearestDistance) { nearestDistance = d; nearestRadius = r; }
        if (d <= r) { withinGeofence = true; break; }
      }
    }
    const onAuthorizedNetwork =
      nets.length > 0 && !!data.ssid && nets.some((n: any) => n.ssid === data.ssid);

    if (hasConstraints && !withinGeofence && !onAuthorizedNetwork) {
      const reasons: string[] = [];
      if (locs.length > 0) {
        if (data.lat == null || data.lng == null) {
          reasons.push("GPS location not available");
        } else if (nearestDistance != null) {
          reasons.push(`GPS outside assigned fence (${Math.round(nearestDistance)} m away, allowed ${nearestRadius} m)`);
        } else {
          reasons.push("GPS outside any assigned location");
        }
      }
      if (nets.length > 0) {
        if (!data.ssid) reasons.push("network SSID not detected");
        else reasons.push(`network "${data.ssid}" is not authorized for you`);
      }
      throw new Error(`Check-in blocked · ${reasons.join(" · ")}.`);
    }

    const { error } = await supabase.from("attendance").upsert({
      employee_id: userId,
      date: today,
      in_time: now,
      branch: data.branch,
      lat: data.lat, lng: data.lng,
      network_ok: data.network_ok,
      note: data.note,
      city: data.city ?? null,
      district: data.district ?? null,
      street: data.street ?? null,
      free_check: freeCheck,
      status: "present",
    }, { onConflict: "employee_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true, free_check: freeCheck, within_geofence: withinGeofence, network_match: onAuthorizedNetwork };
  });

export const checkOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AttendanceCheckSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { error } = await supabase.from("attendance")
      .update({ out_time: now, note: data.note })
      .eq("employee_id", userId).eq("date", today());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance").select("*").eq("employee_id", context.userId)
      .order("date", { ascending: false }).limit(120);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAttendanceRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    employeeIds: z.array(z.string().uuid()).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("attendance").select("*")
      .gte("date", data.from).lte("date", data.to)
      .order("date", { ascending: false }).limit(5000);
    if (data.employeeIds?.length) q = q.in("employee_id", data.employeeIds);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ── Admin CRUD ───────────────────────────────────────────
function combineDateTime(date: string, time?: string | null): string | null {
  if (!time) return null;
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${t}`).toISOString();
}

async function assertAdminOrHr(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "hr");
  if (!ok) throw new Error("Forbidden");
}

export const adminListAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      employeeIds: z.array(z.string().uuid()).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    let q = context.supabase.from("attendance")
      .select("id, employee_id, date, in_time, out_time, branch, status, note, city, district, street, free_check, lat, lng, profiles:employee_id(full_name, email)")
      .gte("date", data.from).lte("date", data.to)
      .order("date", { ascending: false }).limit(5000);
    if (data.employeeIds?.length) q = q.in("employee_id", data.employeeIds);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      employee_id: r.employee_id as string,
      employee_name: (r.profiles?.full_name ?? r.profiles?.email ?? r.employee_id) as string,
      date: r.date as string,
      in_time: r.in_time as string | null,
      out_time: r.out_time as string | null,
      branch: r.branch as string | null,
      status: r.status as string,
      note: r.note as string | null,
      city: (r.city ?? null) as string | null,
      district: (r.district ?? null) as string | null,
      street: (r.street ?? null) as string | null,
      free_check: !!r.free_check,
      lat: r.lat as number | null,
      lng: r.lng as number | null,
    }));
  });

export const adminUpsertAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AdminAttendanceSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const payload = {
      employee_id: data.employee_id,
      date: data.date,
      in_time: combineDateTime(data.date, data.in_time),
      out_time: combineDateTime(data.date, data.out_time),
      branch: data.branch || null,
      status: data.status,
      note: data.note || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("attendance").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("attendance")
      .upsert(payload, { onConflict: "employee_id,date" })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const adminDeleteAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { error } = await context.supabase.from("attendance").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmployeesForAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles").select("id, full_name, email")
      .order("full_name", { ascending: true }).limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ id: r.id as string, name: (r.full_name ?? r.email ?? r.id) as string }));
  });