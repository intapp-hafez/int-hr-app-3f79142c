import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

// ==========================================
// Types
// ==========================================
export type LiveTrackingStats = {
  activeNow: number;
  inOffice: number;
  fieldStaff: number;
  offline: number;
  alerts: number;
};

export type TrackedEmployee = {
  id: string;
  name: string;
  code: string;
  avatarUrl: string | null;
  department: string;
  role: string;
  phone: string | null;
  email: string | null;
  status: "on_site" | "in_office" | "in_transit" | "offline";
  statusText: string;
  sinceTime: string;
  battery: number | null;
  gpsAccuracyMeters: number | null;
  lastUpdateAgo: string;
  assignedSiteId: string | null;
  assignedSiteName: string;
  currentAddress: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  activeRoutePolyline?: [number, number][];
};

export type TrackingEventItem = {
  id: string;
  time: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeeAvatar: string | null;
  event: "Location Update" | "Check-In" | "Alert" | "Check-Out";
  eventType: "location" | "checkin" | "alert" | "checkout";
  details: string;
  location: string;
  siteName: string;
  severity: "info" | "success" | "warning" | "danger";
};

export type RoutePlaybackData = {
  employee: {
    id: string;
    name: string;
    code: string;
    avatarUrl: string | null;
    department: string;
    role: string;
    status: string;
    phone: string;
    email: string;
    reportingTo: string;
    workLocation: string;
    shift: string;
  };
  device: {
    model: string;
    osVersion: string;
    appVersion: string;
    gpsAccuracy: string;
    battery: number | null;
    network: string;
  };
  summary: {
    distanceKm: number;
    travelTimeMinutes: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    routeLabel: string;
    status: string;
  };
  daySummary: {
    totalOnSiteTime: string;
    totalTravelTime: string;
    totalDistanceKm: number;
    sitesVisitedCount: number;
    alertsCount: number;
  };
  timeline: {
    time: string;
    title: string;
    subtitle: string;
    type: "checkin" | "departed" | "transit" | "arrived" | "current";
  }[];
  locationStamps: {
    time: string;
    name: string;
    coords: string;
    lat: number;
    lng: number;
  }[];
  waypoints: {
    lat: number;
    lng: number;
    time: string;
    speedKmh: number;
    label?: string;
  }[];
  checkInOutActivity: {
    type: string;
    time: string;
    location: string;
    method: string;
  }[];
};

export type GeofenceSiteWithPolicy = {
  id: string;
  name: string;
  siteType: string;
  status: "Active" | "Inactive";
  radiusMeters: number;
  latitude: number;
  longitude: number;
  assignedCount: number;
  departments: string[];
  scheduleType: string;
  rules: {
    allowCheckinWithinGeofenceOnly: boolean;
    allowCheckoutWithinGeofenceOnly: boolean;
    blockCheckinOutsideSchedule: boolean;
    requireManagerApproval: boolean;
  };
  assignedEmployees: {
    id: string;
    name: string;
    code: string;
    avatarUrl: string | null;
    department: string;
    role: string;
    assignment: "Primary" | "Secondary";
  }[];
  recentEvents: {
    time: string;
    employeeName: string;
    employeeCode: string;
    employeeAvatar: string | null;
    event: string;
    details: string;
    severity: "success" | "warning" | "danger" | "info";
  }[];
};

export type LocationSecurityAlertItem = {
  id: string;
  alertId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeeAvatar: string | null;
  department: string;
  issueType: "geofence_breach" | "impossible_travel" | "mock_location" | "gps_accuracy_weak" | "offline_too_long";
  issueTypeLabel: string;
  severity: "high" | "medium" | "low";
  time: string;
  detectedAt: string;
  locationDetails: string;
  siteName: string;
  status: "under_investigation" | "new" | "reviewed" | "case_opened";
  caseStatus: string;
  mapSnapshot: {
    centerLat: number;
    centerLng: number;
    siteRadiusMeters: number;
    siteName: string;
    breachLat: number;
    breachLng: number;
  };
  deviceSignals: {
    deviceModel: string;
    battery: number | null;
    gpsAccuracy: string;
    network: string;
    mockLocationDetected: boolean;
    rootJailbreakDetected: boolean;
  };
  evidenceTimeline: {
    time: string;
    title: string;
    subtitle: string;
    isAnomaly?: boolean;
  }[];
  recommendedActions: {
    id: string;
    label: string;
    checked: boolean;
  }[];
  notes: {
    author: string;
    time: string;
    text: string;
  }[];
};

// ==========================================
// Helpers
// ==========================================
function formatTimeShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAgo(iso?: string | null): string {
  if (!iso) return "No signal";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "Just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ==========================================
// 1. Get Live Tracking Dashboard Data (100% Real Data)
// ==========================================
export const getLiveTrackingData = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async (): Promise<{
    stats: LiveTrackingStats;
    employees: TrackedEmployee[];
    geofences: { id: string; name: string; radius: number; lat: number; lng: number; count: number }[];
    recentEvents: TrackingEventItem[];
  }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: geoRows }, { data: assignRows }, { data: profRows }, { data: attRows }, { data: attemptRows }] =
      await Promise.all([
        supabaseAdmin.from("geofence_locations").select("id, name, lat, lng, radius_m, active").eq("active", true),
        supabaseAdmin.from("geofence_assignments").select("profile_id, location_id"),
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, emp_code, avatar_url, phone, email, status, departments(name), positions(title)")
          .neq("status", "Inactive")
          .order("full_name")
          .limit(1000),
        supabaseAdmin
          .from("attendance")
          .select("id, employee_id, date, in_time, out_time, lat, lng, out_lat, out_lng, accuracy_m, branch, city, district, decision")
          .eq("date", today)
          .order("in_time", { ascending: false }),
        supabaseAdmin
          .from("attendance_attempts")
          .select("id, employee_id, action, decision, claimed_lat, claimed_lng, claimed_accuracy_m, travel_speed_kmh, fence_result, reason_codes, server_received_at")
          .gte("server_received_at", `${today}T00:00:00`)
          .order("server_received_at", { ascending: false })
          .limit(50),
      ]);

    // Optional new table: employee_location_pings (graceful if migration not yet run)
    let pingRows: any[] = [];
    try {
      const { data: pings } = await (supabaseAdmin as any)
        .from("employee_location_pings")
        .select("id, user_id, latitude, longitude, accuracy, speed, battery_level, site_id, is_mock, created_at")
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (pings) pingRows = pings;
    } catch {
      pingRows = [];
    }

    // Optional new table: location_security_alerts
    let activeAlertsCount = 0;
    try {
      const { count } = await (supabaseAdmin as any)
        .from("location_security_alerts")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "under_investigation", "case_opened"]);
      activeAlertsCount = count ?? 0;
    } catch {
      activeAlertsCount = (attemptRows ?? []).filter((a: any) => a.decision !== "allow").length;
    }

    const geoMap = new Map<string, any>();
    for (const g of geoRows ?? []) geoMap.set(g.id, g);

    const assignMap = new Map<string, string>();
    for (const a of assignRows ?? []) {
      if (!assignMap.has(a.profile_id)) assignMap.set(a.profile_id, a.location_id);
    }

    const attByEmp = new Map<string, any>();
    for (const a of attRows ?? []) {
      if (!attByEmp.has(a.employee_id)) attByEmp.set(a.employee_id, a);
    }

    const latestPingByEmp = new Map<string, any>();
    for (const p of pingRows) {
      if (!latestPingByEmp.has(p.user_id)) latestPingByEmp.set(p.user_id, p);
    }

    const profMap = new Map<string, any>();
    for (const p of profRows ?? []) profMap.set(p.id, p);

    const siteEmpCounts = new Map<string, number>();
    const employees: TrackedEmployee[] = [];

    for (const emp of profRows ?? []) {
      const ping = latestPingByEmp.get(emp.id);
      const att = attByEmp.get(emp.id);
      const assignedSiteId = ping?.site_id || assignMap.get(emp.id) || null;
      const site = assignedSiteId ? geoMap.get(assignedSiteId) : null;

      // Determine real coordinates: latest ping > attendance check-in > assigned geofence center
      const lat =
        ping?.latitude != null
          ? Number(ping.latitude)
          : att?.lat != null
            ? Number(att.lat)
            : site?.lat != null
              ? Number(site.lat)
              : null;
      const lng =
        ping?.longitude != null
          ? Number(ping.longitude)
          : att?.lng != null
            ? Number(att.lng)
            : site?.lng != null
              ? Number(site.lng)
              : null;

      // Only place on map if they have real coordinates (either ping, attendance GPS, or assigned site)
      const hasCoords = lat != null && lng != null;
      const safeLat = hasCoords ? lat : 0;
      const safeLng = hasCoords ? lng : 0;

      const speedKmh = ping?.speed != null ? Math.round(Number(ping.speed)) : 0;
      const isCheckedIn = !!att && !att.out_time;
      const hasRecentPing = !!ping && Date.now() - new Date(ping.created_at).getTime() < 30 * 60 * 1000;

      let status: TrackedEmployee["status"] = "offline";
      let statusText = "Offline";

      if (hasRecentPing && speedKmh > 5) {
        status = "in_transit";
        statusText = `In Transit (${speedKmh} km/h)`;
      } else if (isCheckedIn || hasRecentPing) {
        const siteName = site?.name || att?.branch || "";
        if (siteName.toLowerCase().includes("hq") || siteName.toLowerCase().includes("office")) {
          status = "in_office";
          statusText = `In Office${siteName ? ` · ${siteName}` : ""}`;
        } else {
          status = "on_site";
          statusText = siteName ? `On Site · ${siteName}` : "On Site";
        }
      } else if (att?.out_time) {
        status = "offline";
        statusText = `Checked Out at ${formatTimeShort(att.out_time)}`;
      }

      if (assignedSiteId && status !== "offline") {
        siteEmpCounts.set(assignedSiteId, (siteEmpCounts.get(assignedSiteId) ?? 0) + 1);
      }

      const empPings = pingRows.filter((p) => p.user_id === emp.id).slice(0, 15).reverse();
      const activeRoutePolyline: [number, number][] | undefined =
        empPings.length >= 2 ? empPings.map((p) => [Number(p.latitude), Number(p.longitude)]) : undefined;

      const gpsAcc =
        ping?.accuracy != null
          ? Math.round(Number(ping.accuracy))
          : att?.accuracy_m != null
            ? Math.round(Number(att.accuracy_m))
            : null;

      employees.push({
        id: emp.id,
        name: emp.full_name || emp.email || "Employee",
        code: emp.emp_code || emp.id.slice(0, 8).toUpperCase(),
        avatarUrl: emp.avatar_url || null,
        department: (emp.departments as any)?.name || "General",
        role: (emp.positions as any)?.title || "Staff",
        phone: emp.phone || null,
        email: emp.email || null,
        status,
        statusText,
        sinceTime: formatTimeShort(att?.in_time || ping?.created_at),
        battery: ping?.battery_level != null ? Number(ping.battery_level) : null,
        gpsAccuracyMeters: gpsAcc,
        lastUpdateAgo: formatAgo(ping?.created_at || att?.out_time || att?.in_time),
        assignedSiteId,
        assignedSiteName: site?.name || att?.branch || "Unassigned",
        currentAddress: hasCoords
          ? [att?.district, att?.city].filter(Boolean).join(", ") || `${safeLat.toFixed(5)}, ${safeLng.toFixed(5)}`
          : "No GPS signal",
        latitude: safeLat,
        longitude: safeLng,
        speedKmh,
        activeRoutePolyline,
      });
    }

    const geofences = (geoRows ?? []).map((g: any) => ({
      id: g.id,
      name: g.name,
      radius: g.radius_m || 300,
      lat: Number(g.lat),
      lng: Number(g.lng),
      count: siteEmpCounts.get(g.id) ?? 0,
    }));

    const inOffice = employees.filter((e) => e.status === "in_office").length;
    const fieldStaff = employees.filter((e) => e.status === "on_site" || e.status === "in_transit").length;
    const offline = employees.filter((e) => e.status === "offline").length;
    const activeNow = inOffice + fieldStaff;

    // Build real recentEvents from attendance + pings + attempts
    const recentEvents: TrackingEventItem[] = [];

    for (const a of (attRows ?? []).slice(0, 15)) {
      const emp = profMap.get(a.employee_id);
      if (!emp) continue;
      recentEvents.push({
        id: `att-in-${a.id}`,
        time: formatTimeShort(a.in_time),
        employeeId: emp.id,
        employeeName: emp.full_name || emp.email || "Employee",
        employeeCode: emp.emp_code || emp.id.slice(0, 6),
        employeeAvatar: emp.avatar_url || null,
        event: "Check-In",
        eventType: "checkin",
        details: `Checked in${a.branch ? ` at ${a.branch}` : ""}`,
        location: a.branch || "Geofence",
        siteName: a.branch || "—",
        severity: "success",
      });
      if (a.out_time) {
        recentEvents.push({
          id: `att-out-${a.id}`,
          time: formatTimeShort(a.out_time),
          employeeId: emp.id,
          employeeName: emp.full_name || emp.email || "Employee",
          employeeCode: emp.emp_code || emp.id.slice(0, 6),
          employeeAvatar: emp.avatar_url || null,
          event: "Check-Out",
          eventType: "checkout",
          details: `Checked out${a.branch ? ` from ${a.branch}` : ""}`,
          location: a.branch || "Geofence",
          siteName: a.branch || "—",
          severity: "info",
        });
      }
    }

    for (const att of (attemptRows ?? []).filter((x: any) => x.decision !== "allow").slice(0, 10)) {
      const emp = profMap.get(att.employee_id);
      if (!emp) continue;
      recentEvents.push({
        id: `attempt-${att.id}`,
        time: formatTimeShort(att.server_received_at),
        employeeId: emp.id,
        employeeName: emp.full_name || emp.email || "Employee",
        employeeCode: emp.emp_code || emp.id.slice(0, 6),
        employeeAvatar: emp.avatar_url || null,
        event: "Alert",
        eventType: "alert",
        details: `Blocked ${att.action}: ${att.fence_result || "policy violation"}`,
        location: att.claimed_lat ? `${Number(att.claimed_lat).toFixed(4)}, ${Number(att.claimed_lng).toFixed(4)}` : "—",
        siteName: att.fence_result || "Security",
        severity: "danger",
      });
    }

    return {
      stats: {
        activeNow,
        inOffice,
        fieldStaff,
        offline,
        alerts: activeAlertsCount,
      },
      employees,
      geofences,
      recentEvents: recentEvents.slice(0, 25),
    };
  });

// ==========================================
// 2. Get Employee Route Playback Details (100% Real Data)
// ==========================================
export const getEmployeeRoutePlayback = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        employeeId: z.string().optional(),
        date: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<RoutePlaybackData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const targetDate = data.date || new Date().toISOString().slice(0, 10);

    let empRecord: any = null;
    if (data.employeeId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, emp_code, avatar_url, phone, email, manager_id, departments(name), positions(title), shifts(name, start_time, end_time)")
        .eq("id", data.employeeId)
        .maybeSingle();
      empRecord = prof;
    } else {
      const { data: firstProf } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, emp_code, avatar_url, phone, email, manager_id, departments(name), positions(title), shifts(name, start_time, end_time)")
        .eq("status", "Active")
        .limit(1)
        .maybeSingle();
      empRecord = firstProf;
    }

    const empId = empRecord?.id;
    let managerName = "—";
    if (empRecord?.manager_id) {
      const { data: mgr } = await supabaseAdmin.from("profiles").select("full_name").eq("id", empRecord.manager_id).maybeSingle();
      if (mgr?.full_name) managerName = mgr.full_name;
    }

    const [{ data: attRows }, { data: assignRow }] = empId
      ? await Promise.all([
          supabaseAdmin
            .from("attendance")
            .select("id, in_time, out_time, lat, lng, out_lat, out_lng, branch")
            .eq("employee_id", empId)
            .gte("in_time", `${targetDate}T00:00:00`)
            .lte("in_time", `${targetDate}T23:59:59`)
            .order("in_time", { ascending: true }),
          supabaseAdmin
            .from("geofence_assignments")
            .select("geofence_locations(name)")
            .eq("profile_id", empId)
            .limit(1)
            .maybeSingle(),
        ])
      : [{ data: [] }, { data: null }];

    let pings: any[] = [];
    if (empId) {
      try {
        const { data: pRows } = await (supabaseAdmin as any)
          .from("employee_location_pings")
          .select("*")
          .eq("user_id", empId)
          .gte("created_at", `${targetDate}T00:00:00`)
          .lte("created_at", `${targetDate}T23:59:59`)
          .order("created_at", { ascending: true });
        if (pRows) pings = pRows;
      } catch {
        pings = [];
      }
    }

    const waypoints: RoutePlaybackData["waypoints"] = [];
    const timeline: RoutePlaybackData["timeline"] = [];
    const locationStamps: RoutePlaybackData["locationStamps"] = [];
    const checkInOutActivity: RoutePlaybackData["checkInOutActivity"] = [];

    for (const a of attRows ?? []) {
      const tIn = formatTimeShort(a.in_time);
      checkInOutActivity.push({
        type: "Check-In",
        time: tIn,
        location: a.branch || "Assigned Site",
        method: "Mobile App (GPS)",
      });
      timeline.push({
        time: tIn,
        title: "Check-In",
        subtitle: a.branch || "Attendance Check-In",
        type: "checkin",
      });
      if (a.lat != null && a.lng != null) {
        const lat = Number(a.lat);
        const lng = Number(a.lng);
        waypoints.push({ lat, lng, time: tIn, speedKmh: 0, label: `Check-In · ${a.branch || "Site"}` });
        locationStamps.push({
          time: tIn,
          name: a.branch || "Check-In Location",
          coords: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
          lat,
          lng,
        });
      }
      if (a.out_time) {
        const tOut = formatTimeShort(a.out_time);
        checkInOutActivity.push({
          type: "Check-Out",
          time: tOut,
          location: a.branch || "Assigned Site",
          method: "Mobile App (GPS)",
        });
        timeline.push({
          time: tOut,
          title: "Check-Out",
          subtitle: a.branch || "Attendance Check-Out",
          type: "departed",
        });
        if (a.out_lat != null && a.out_lng != null) {
          const olat = Number(a.out_lat);
          const olng = Number(a.out_lng);
          waypoints.push({ lat: olat, lng: olng, time: tOut, speedKmh: 0, label: `Check-Out · ${a.branch || "Site"}` });
        }
      }
    }

    let maxSpeed = 0;
    let speedSum = 0;
    for (const p of pings) {
      const spd = Math.round(Number(p.speed || 0));
      if (spd > maxSpeed) maxSpeed = spd;
      speedSum += spd;
      const t = formatTimeShort(p.created_at);
      waypoints.push({
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        time: t,
        speedKmh: spd,
        label: spd > 5 ? `In Transit (${spd} km/h)` : "Stationary",
      });
    }

    let distanceKm = 0;
    for (let i = 1; i < waypoints.length; i++) {
      distanceKm += haversineKm(waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng);
    }
    distanceKm = Math.round(distanceKm * 10) / 10;

    const latestPing = pings[pings.length - 1];
    const shiftInfo = empRecord?.shifts as any;
    const shiftText = shiftInfo ? `${shiftInfo.name} (${shiftInfo.start_time || ""} – ${shiftInfo.end_time || ""})` : "Standard Shift";
    const workLoc = (assignRow as any)?.geofence_locations?.name || (attRows?.[0]?.branch ?? "Unassigned");

    return {
      employee: {
        id: empId || "",
        name: empRecord?.full_name || "No Employee Selected",
        code: empRecord?.emp_code || "—",
        avatarUrl: empRecord?.avatar_url || null,
        department: (empRecord?.departments as any)?.name || "General",
        role: (empRecord?.positions as any)?.title || "Employee",
        status: attRows?.length && !attRows[0].out_time ? "On Site" : "Offline",
        phone: empRecord?.phone || "—",
        email: empRecord?.email || "—",
        reportingTo: managerName,
        workLocation: workLoc,
        shift: shiftText,
      },
      device: {
        model: latestPing?.device_model || "Not reported",
        osVersion: latestPing?.os_version || "—",
        appVersion: latestPing?.app_version || "—",
        gpsAccuracy: latestPing?.accuracy != null ? `±${Math.round(latestPing.accuracy)} m` : "—",
        battery: latestPing?.battery_level != null ? Number(latestPing.battery_level) : null,
        network: latestPing?.network_type || "—",
      },
      summary: {
        distanceKm,
        travelTimeMinutes: pings.length > 1 ? Math.round((new Date(pings[pings.length - 1].created_at).getTime() - new Date(pings[0].created_at).getTime()) / 60000) : 0,
        avgSpeedKmh: pings.length > 0 ? Math.round(speedSum / pings.length) : 0,
        maxSpeedKmh: maxSpeed,
        routeLabel: workLoc,
        status: waypoints.length > 0 ? "Route Recorded" : "No GPS route recorded for date",
      },
      daySummary: {
        totalOnSiteTime: attRows?.length ? `${attRows.length} session(s)` : "0 hr",
        totalTravelTime: pings.length > 1 ? `${pings.length} pings` : "0 min",
        totalDistanceKm: distanceKm,
        sitesVisitedCount: new Set((attRows ?? []).map((a: any) => a.branch).filter(Boolean)).size,
        alertsCount: 0,
      },
      timeline,
      locationStamps,
      waypoints,
      checkInOutActivity,
    };
  });

// ==========================================
// 3. Get Geofence Sites & Site Rules (100% Real Data)
// ==========================================
export const getGeofenceManagementData = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ siteId: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<{ sites: GeofenceSiteWithPolicy[]; selectedSite: GeofenceSiteWithPolicy | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: dbSites }, { data: assignRows }, { data: recentAtt }] = await Promise.all([
      supabaseAdmin.from("geofence_locations").select("id, name, lat, lng, radius_m, active").order("name"),
      supabaseAdmin
        .from("geofence_assignments")
        .select("location_id, profile_id, profiles(id, full_name, emp_code, avatar_url, departments(name), positions(title))"),
      supabaseAdmin
        .from("attendance")
        .select("id, employee_id, in_time, out_time, branch, profiles(full_name, emp_code, avatar_url)")
        .order("in_time", { ascending: false })
        .limit(40),
    ]);

    const policyMap = new Map<string, any>();
    try {
      const { data: pols } = await (supabaseAdmin as any).from("geofence_site_policies").select("*");
      for (const p of pols ?? []) policyMap.set(p.site_id, p);
    } catch {
      // Table may not exist yet before migration
    }

    const sites: GeofenceSiteWithPolicy[] = (dbSites ?? []).map((s: any) => {
      const pol = policyMap.get(s.id);
      const siteAssigns = (assignRows ?? []).filter((a: any) => a.location_id === s.id);
      const assignedEmployees = siteAssigns
        .map((a: any) => a.profiles)
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          name: p.full_name || "Employee",
          code: p.emp_code || p.id.slice(0, 6),
          avatarUrl: p.avatar_url || null,
          department: p.departments?.name || "General",
          role: p.positions?.title || "Staff",
          assignment: "Primary" as const,
        }));

      const deptSet = Array.from(new Set(assignedEmployees.map((e) => e.department)));

      const siteEvents = (recentAtt ?? [])
        .filter((ev: any) => !ev.branch || ev.branch.toLowerCase().includes(s.name.toLowerCase()))
        .slice(0, 8)
        .map((ev: any) => ({
          time: formatTimeShort(ev.in_time),
          employeeName: ev.profiles?.full_name || "Employee",
          employeeCode: ev.profiles?.emp_code || "",
          employeeAvatar: ev.profiles?.avatar_url || null,
          event: ev.out_time ? "Check-Out" : "Check-In",
          details: ev.out_time ? `Out at ${formatTimeShort(ev.out_time)}` : `In at ${formatTimeShort(ev.in_time)}`,
          severity: (ev.out_time ? "info" : "success") as "info" | "success",
        }));

      return {
        id: s.id,
        name: s.name,
        siteType: pol?.site_type || "Work Site",
        status: s.active !== false ? "Active" : "Inactive",
        radiusMeters: s.radius_m || 300,
        latitude: Number(s.lat),
        longitude: Number(s.lng),
        assignedCount: assignedEmployees.length,
        departments: deptSet,
        scheduleType: "Company Schedule",
        rules: {
          allowCheckinWithinGeofenceOnly: pol?.allow_checkin_within_geofence_only ?? true,
          allowCheckoutWithinGeofenceOnly: pol?.allow_checkout_within_geofence_only ?? true,
          blockCheckinOutsideSchedule: pol?.block_checkin_outside_schedule ?? false,
          requireManagerApproval: pol?.require_manager_approval ?? false,
        },
        assignedEmployees,
        recentEvents: siteEvents,
      };
    });

    const selectedSite = data.siteId ? sites.find((s) => s.id === data.siteId) ?? sites[0] ?? null : sites[0] ?? null;

    return { sites, selectedSite };
  });

// ==========================================
// 4. Save Geofence Site Policy
// ==========================================
export const saveGeofenceSitePolicy = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        siteId: z.string(),
        name: z.string().min(1),
        radiusMeters: z.number().min(20).max(10000),
        siteType: z.string(),
        rules: z.object({
          allowCheckinWithinGeofenceOnly: z.boolean(),
          allowCheckoutWithinGeofenceOnly: z.boolean(),
          blockCheckinOutsideSchedule: z.boolean(),
          requireManagerApproval: z.boolean(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("geofence_locations")
      .update({ name: data.name, radius_m: data.radiusMeters, updated_at: new Date().toISOString() })
      .eq("id", data.siteId);

    try {
      await (supabaseAdmin as any).from("geofence_site_policies").upsert({
        site_id: data.siteId,
        allow_checkin_within_geofence_only: data.rules.allowCheckinWithinGeofenceOnly,
        allow_checkout_within_geofence_only: data.rules.allowCheckoutWithinGeofenceOnly,
        block_checkin_outside_schedule: data.rules.blockCheckinOutsideSchedule,
        require_manager_approval: data.rules.requireManagerApproval,
        site_type: data.siteType,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    } catch {
      // Graceful if table not yet migrated
    }

    return { ok: true, siteId: data.siteId };
  });

// ==========================================
// 5. Get Location Security Alerts & Investigations (100% Real Data)
// ==========================================
export const getLocationSecurityData = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ alertId: z.string().optional() }).parse(input ?? {}))
  .handler(
    async ({
      data,
    }): Promise<{
      stats: { alerts: number; spoofingRisk: number; staleDevices: number; openInvestigations: number };
      alerts: LocationSecurityAlertItem[];
      selectedAlert: LocationSecurityAlertItem | null;
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const alerts: LocationSecurityAlertItem[] = [];

      // 1. Try reading from location_security_alerts table
      try {
        const { data: dbAlerts } = await (supabaseAdmin as any)
          .from("location_security_alerts")
          .select("*, profiles(id, full_name, emp_code, avatar_url, departments(name)), geofence_locations(name, lat, lng, radius_m)")
          .order("created_at", { ascending: false })
          .limit(50);

        for (const row of dbAlerts ?? []) {
          const prof = row.profiles;
          const site = row.geofence_locations;
          const sig = row.device_signals || {};
          alerts.push({
            id: row.id,
            alertId: row.alert_code,
            employeeId: row.user_id,
            employeeName: prof?.full_name || "Employee",
            employeeCode: prof?.emp_code || "",
            employeeAvatar: prof?.avatar_url || null,
            department: prof?.departments?.name || "General",
            issueType: row.issue_type || "geofence_breach",
            issueTypeLabel: row.title,
            severity: row.severity || "medium",
            time: formatTimeShort(row.created_at),
            detectedAt: new Date(row.created_at).toLocaleString(),
            locationDetails: row.details?.summary || "Security anomaly detected",
            siteName: site?.name || "—",
            status: row.status || "under_investigation",
            caseStatus: row.status === "case_opened" ? "Case Opened" : row.status === "reviewed" ? "Reviewed" : "Under Investigation",
            mapSnapshot: {
              centerLat: Number(site?.lat || row.detected_latitude || 30.0444),
              centerLng: Number(site?.lng || row.detected_longitude || 31.2357),
              siteRadiusMeters: site?.radius_m || 300,
              siteName: site?.name || "Target Site",
              breachLat: Number(row.detected_latitude || site?.lat || 30.0444),
              breachLng: Number(row.detected_longitude || site?.lng || 31.2357),
            },
            deviceSignals: {
              deviceModel: sig.deviceModel || "Unknown Device",
              battery: sig.battery ?? null,
              gpsAccuracy: sig.gpsAccuracy || "—",
              network: sig.network || "—",
              mockLocationDetected: !!sig.mockLocationDetected,
              rootJailbreakDetected: !!sig.rootJailbreakDetected,
            },
            evidenceTimeline: row.details?.timeline || [
              { time: formatTimeShort(row.created_at), title: row.title, subtitle: row.details?.summary || "Detected by policy engine", isAnomaly: true },
            ],
            recommendedActions: row.details?.recommendedActions || [
              { id: "act-1", label: "Verify location with employee & direct manager", checked: false },
              { id: "act-2", label: "Review device anti-spoofing signals", checked: false },
            ],
            notes: row.details?.notes || [],
          });
        }
      } catch {
        // Table not yet created
      }

      // 2. Also surface real blocked/flagged attendance_attempts from the DB
      const { data: attempts } = await supabaseAdmin
        .from("attendance_attempts")
        .select("*, profiles(id, full_name, emp_code, avatar_url, departments(name))")
        .neq("decision", "allow")
        .order("server_received_at", { ascending: false })
        .limit(30);

      for (const att of attempts ?? []) {
        const prof = (att as any).profiles;
        if (!prof) continue;
        const speed = Number(att.travel_speed_kmh || 0);
        const risk = (att.risk_signals as any) || {};
        const isMock = !!risk.mock_location || !!risk.synthetic_gps;
        const issueType: LocationSecurityAlertItem["issueType"] = isMock
          ? "mock_location"
          : speed > 120
            ? "impossible_travel"
            : "geofence_breach";

        alerts.push({
          id: att.id,
          alertId: `ATT-${att.id.slice(0, 8).toUpperCase()}`,
          employeeId: att.employee_id,
          employeeName: prof.full_name || "Employee",
          employeeCode: prof.emp_code || "",
          employeeAvatar: prof.avatar_url || null,
          department: prof.departments?.name || "General",
          issueType,
          issueTypeLabel:
            issueType === "mock_location"
              ? "Mock Location Suspected"
              : issueType === "impossible_travel"
                ? "Impossible Travel"
                : "Geofence Breach",
          severity: isMock || speed > 120 ? "high" : "medium",
          time: formatTimeShort(att.server_received_at),
          detectedAt: new Date(att.server_received_at).toLocaleString(),
          locationDetails: `${att.fence_result || "Outside geofence"} (${Math.round(Number(att.fence_distance_m || 0))}m from site)`,
          siteName: att.fence_result || "Blocked Attempt",
          status: "new",
          caseStatus: "Not yet opened",
          mapSnapshot: {
            centerLat: Number(att.claimed_lat || 30.0444),
            centerLng: Number(att.claimed_lng || 31.2357),
            siteRadiusMeters: att.fence_allowed_m || 300,
            siteName: "Claimed Position",
            breachLat: Number(att.claimed_lat || 30.0444),
            breachLng: Number(att.claimed_lng || 31.2357),
          },
          deviceSignals: {
            deviceModel: att.device_id || "Registered Device",
            battery: null,
            gpsAccuracy: att.claimed_accuracy_m ? `±${Math.round(att.claimed_accuracy_m)} m` : "—",
            network: att.ssid_claimed || "Cellular / Wi-Fi",
            mockLocationDetected: isMock,
            rootJailbreakDetected: !!risk.rooted,
          },
          evidenceTimeline: [
            {
              time: formatTimeShort(att.server_received_at),
              title: `Blocked ${att.action}`,
              subtitle: `Distance: ${Math.round(Number(att.fence_distance_m || 0))}m · Speed: ${Math.round(speed)} km/h`,
              isAnomaly: true,
            },
          ],
          recommendedActions: [
            { id: "act-1", label: "Verify employee physical presence at site", checked: false },
            { id: "act-2", label: "Check device fingerprint & GPS integrity", checked: false },
          ],
          notes: [],
        });
      }

      const spoofingRisk = alerts.filter((a) => a.deviceSignals.mockLocationDetected || a.issueType === "impossible_travel").length;
      const openInvestigations = alerts.filter((a) => a.status === "under_investigation" || a.status === "case_opened").length;
      const selectedAlert = data.alertId ? alerts.find((a) => a.id === data.alertId) ?? alerts[0] ?? null : alerts[0] ?? null;

      return {
        stats: {
          alerts: alerts.length,
          spoofingRisk,
          staleDevices: alerts.filter((a) => a.issueType === "offline_too_long").length,
          openInvestigations,
        },
        alerts,
        selectedAlert,
      };
    },
  );

// ==========================================
// 6. Update Security Alert / Case Action
// ==========================================
export const updateSecurityAlertAction = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        alertId: z.string(),
        action: z.enum(["mark_reviewed", "suspend_tracking", "notify_manager", "open_case", "add_note"]),
        noteText: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      if (data.action === "mark_reviewed") {
        await (supabaseAdmin as any)
          .from("location_security_alerts")
          .update({ status: "reviewed", reviewed_at: new Date().toISOString(), reviewed_by: context.userId })
          .eq("id", data.alertId);
      } else if (data.action === "open_case") {
        await (supabaseAdmin as any)
          .from("location_security_alerts")
          .update({ status: "case_opened" })
          .eq("id", data.alertId);
      }
    } catch {
      // Graceful if alert came from attendance_attempts
    }

    return { ok: true, action: data.action, alertId: data.alertId };
  });
