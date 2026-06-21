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

    // 0. One check-in per day
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, in_time")
      .eq("employee_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (existing?.in_time) {
      return {
        ok: false as const,
        blocked: true as const,
        code: "check_in_already" as const,
        params: {} as Record<string, any>,
        reason: "Check-in blocked · you have already checked in today.",
      };
    }

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
      const raw = (leaveRow.leave_type_name ?? '').trim();
      const hasName = !!raw;
      const leaveName = raw
        ? (/leave$/i.test(raw) ? raw : `${raw} leave`)
        : 'a leave day';
      const start = leaveRow.start_date ?? '';
      const end = leaveRow.end_date ?? '';
      const dateRange = start === end ? start : `${start} – ${end}`;
      return {
        ok: false as const, blocked: true as const,
        code: (hasName ? "leave" : "leave_noname") as "leave" | "leave_noname",
        params: { action: "check_in", name: leaveName, range: dateRange } as Record<string, any>,
        reason: `Check-in blocked · Today is ${leaveName} (${dateRange}).`,
      };
    }
    // 2. Holiday
    if (holidayRow) {
      return {
        ok: false as const, blocked: true as const,
        code: "holiday" as const,
        params: { action: "check_in", name: holidayRow.name } as Record<string, any>,
        reason: `Check-in blocked · today is a holiday (${holidayRow.name}).`,
      };
    }
    // 3. Weekend (Fri/Sat)
    if (isWeekend) {
      return {
        ok: false as const, blocked: true as const,
        code: "weekend" as const,
        params: { action: "check_in" } as Record<string, any>,
        reason: "Check-in blocked · today is a weekend (Friday / Saturday).",
      };
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
      const reasonCodes: Array<{ code: string; params?: Record<string, any> }> = [];
      const reasons: string[] = [];
      if (locs.length > 0) {
        if (data.lat == null || data.lng == null) {
          reasonCodes.push({ code: "gps_unavailable" });
          reasons.push("GPS location not available");
        } else if (nearestDistance != null) {
          reasonCodes.push({ code: "gps_outside_fence", params: { dist: Math.round(nearestDistance), allowed: nearestRadius } });
          reasons.push(`GPS outside assigned fence (${Math.round(nearestDistance)} m away, allowed ${nearestRadius} m)`);
        } else {
          reasonCodes.push({ code: "gps_outside_any" });
          reasons.push("GPS outside any assigned location");
        }
      }
      if (nets.length > 0) {
        if (!data.ssid) { reasonCodes.push({ code: "ssid_undetected" }); reasons.push("network SSID not detected"); }
        else { reasonCodes.push({ code: "ssid_not_authorized", params: { ssid: data.ssid } }); reasons.push(`network "${data.ssid}" is not authorized for you`); }
      }
      return {
        ok: false as const, blocked: true as const,
        code: "constraints" as const,
        params: { action: "check_in", reasons: reasonCodes } as Record<string, any>,
        reason: `Check-in blocked · ${reasons.join(" · ")}.`,
      };
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
    return { ok: true as const, blocked: false as const, free_check: freeCheck, within_geofence: withinGeofence, network_match: onAuthorizedNetwork };
  });

export const checkOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AttendanceCheckSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const { data: row } = await supabase
      .from("attendance")
      .select("id, in_time, out_time")
      .eq("employee_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (!row?.in_time) {
      return {
        ok: false as const, blocked: true as const,
        code: "check_out_not_in" as const,
        params: {} as Record<string, any>,
        reason: "Check-out blocked · you have not checked in today.",
      };
    }
    if (row.out_time) {
      return {
        ok: false as const, blocked: true as const,
        code: "check_out_already" as const,
        params: {} as Record<string, any>,
        reason: "Check-out blocked · you have already checked out today.",
      };
    }

    const dow = new Date(today + "T00:00:00Z").getUTCDay();
    const isWeekend = dow === 5 || dow === 6;
    const [{ data: leaveRow }, { data: holidayRow }] = await Promise.all([
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

    if (leaveRow) {
      const raw = (leaveRow.leave_type_name ?? '').trim();
      const hasName = !!raw;
      const leaveName = raw
        ? (/leave$/i.test(raw) ? raw : `${raw} leave`)
        : 'a leave day';
      const start = leaveRow.start_date ?? '';
      const end = leaveRow.end_date ?? '';
      const dateRange = start === end ? start : `${start} – ${end}`;
      return {
        ok: false as const, blocked: true as const,
        code: (hasName ? "leave" : "leave_noname") as "leave" | "leave_noname",
        params: { action: "check_out", name: leaveName, range: dateRange } as Record<string, any>,
        reason: `Check-out blocked · Today is ${leaveName} (${dateRange}).`,
      };
    }
    if (holidayRow) {
      return {
        ok: false as const, blocked: true as const,
        code: "holiday" as const,
        params: { action: "check_out", name: holidayRow.name } as Record<string, any>,
        reason: `Check-out blocked · today is a holiday (${holidayRow.name}).`,
      };
    }
    if (isWeekend) {
      return {
        ok: false as const, blocked: true as const,
        code: "weekend" as const,
        params: { action: "check_out" } as Record<string, any>,
        reason: "Check-out blocked · today is a weekend (Friday / Saturday).",
      };
    }

    const { error } = await supabase.from("attendance")
      .update({
        out_time: now,
        note: data.note,
        out_lat: data.lat ?? null,
        out_lng: data.lng ?? null,
        out_city: data.city ?? null,
        out_district: data.district ?? null,
        out_street: data.street ?? null,
      })
      .eq("employee_id", userId).eq("date", today);
    if (error) throw new Error(error.message);
    return { ok: true as const, blocked: false as const };
  });

export const listMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: geo }, { data: nets }] = await Promise.all([
      supabase
        .from("geofence_assignments")
        .select("geofence_locations(id, name, lat, lng, radius_m, active)")
        .eq("profile_id", userId) as any,
      supabase
        .from("network_assignments")
        .select("networks(id, name, ssid, bssid, is_active)")
        .eq("profile_id", userId) as any,
    ]);
    const locations = ((geo ?? []) as any[])
      .map((a) => a.geofence_locations)
      .filter((l: any) => l && l.active)
      .map((l: any) => ({
        id: l.id as string,
        name: l.name as string,
        lat: Number(l.lat),
        lng: Number(l.lng),
        radius_m: Number(l.radius_m ?? 100),
      }));
    const networks = ((nets ?? []) as any[])
      .map((a) => a.networks)
      .filter((n: any) => n && n.is_active)
      .map((n: any) => ({
        id: n.id as string,
        name: n.name as string,
        ssid: (n.ssid ?? null) as string | null,
        bssid: (n.bssid ?? null) as string | null,
      }));
    return { locations, networks };
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

function dedupeLocationParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => {
      if (!part) return false;
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

export const adminReverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    try {
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${data.lat}&longitude=${data.lng}&localityLanguage=en`,
      );
      if (r.ok) {
        const j: any = await r.json();
        const admin: any[] = j.localityInfo?.administrative ?? [];
        const city = j.city || admin.find((a) => a.adminLevel === 4)?.name || "";
        const locality = j.locality || admin.find((a) => a.adminLevel >= 7)?.name || "";
        const street = [j.streetNumber, j.streetName].filter(Boolean).join(" ");
        const label = dedupeLocationParts([street, locality, city]);
        if (label) return label;
      }
    } catch {
      // Try OpenStreetMap fallback below.
    }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${data.lat}&lon=${data.lng}&accept-language=en&addressdetails=1`,
        { headers: { "User-Agent": "HR-App attendance location lookup" } },
      );
      if (r.ok) {
        const j: any = await r.json();
        const address = j.address ?? {};
        const road = [address.house_number, address.road].filter(Boolean).join(" ");
        const locality = address.suburb || address.neighbourhood || address.city_district || address.town || "";
        const city = address.city || address.state || address.county || "";
        const label = dedupeLocationParts([road, locality, city]);
        if (label) return label;
      }
    } catch {
      // Fall through to a non-coordinate placeholder.
    }
    return "Location name unavailable";
  });

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
      .select("id, employee_id, date, in_time, out_time, branch, status, note, city, district, street, free_check, lat, lng, out_lat, out_lng, out_city, out_district, out_street, profiles:employee_id(full_name, email)")
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
      out_lat: (r.out_lat ?? null) as number | null,
      out_lng: (r.out_lng ?? null) as number | null,
      out_city: (r.out_city ?? null) as string | null,
      out_district: (r.out_district ?? null) as string | null,
      out_street: (r.out_street ?? null) as string | null,
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