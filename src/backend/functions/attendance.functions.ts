import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dateRangeSchema } from "../schemas/date-range";
import { parseInput } from "../schemas/validation-error";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AttendanceCheckSchema, AdminAttendanceSchema } from "../schemas";
import { isoWeekday } from "@/lib/date-format";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";
import { enforceAttendanceRateLimit } from "./attendance-rate-limit.server";
import { logBiometricEvent } from "@/backend/server/biometric-audit.server";

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

async function logAttendanceBio(
  userId: string,
  data: z.infer<typeof AttendanceCheckSchema>,
  event: "check_in" | "check_out",
  success: boolean,
  reason?: string | null,
  overrideMethod?: "face" | "fingerprint" | "none",
  overrideDistance?: number | null,
) {
  const method = overrideMethod === "none" ? "face" : overrideMethod ?? data.biometric_method ?? "face";
  await logBiometricEvent({
    userId,
    method,
    event,
    success,
    reason: reason ?? null,
    deviceId: data.device_id ?? null,
    distance: overrideDistance ?? data.biometric_distance ?? null,
  });
}

async function validateAndConsumeBioToken(
  supabase: any,
  userId: string,
  token: string | null | undefined,
  action: "check_in" | "check_out",
  faceRequired: boolean,
): Promise<
  | { ok: true; method: "face" | "fingerprint" | "none"; distance: number | null }
  | { ok: false; code: string; reason: string }
> {
  // If face is not required and no token was provided, allow without biometrics
  if (!faceRequired && !token) {
    return { ok: true, method: "none", distance: null };
  }

  if (!token) {
    return {
      ok: false,
      code: "face_required",
      reason: `${action === "check_in" ? "Check-in" : "Check-out"} blocked · face recognition is required. Please scan your face first.`,
    };
  }

  const { data: tokenRow, error: tokenErr } = await supabase
    .from("biometric_verification_tokens")
    .select("id, token, user_id, action, method, distance, expires_at, used_at")
    .eq("token", token)
    .eq("user_id", userId)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return {
      ok: false,
      code: "biometric_invalid",
      reason: `${action === "check_in" ? "Check-in" : "Check-out"} blocked · invalid biometric verification token. Please verify again.`,
    };
  }

  if (tokenRow.used_at) {
    return {
      ok: false,
      code: "biometric_replayed",
      reason: `${action === "check_in" ? "Check-in" : "Check-out"} blocked · this biometric verification has already been used. Please scan again.`,
    };
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      code: "biometric_expired",
      reason: `${action === "check_in" ? "Check-in" : "Check-out"} blocked · biometric verification expired (valid for 2 minutes). Please scan again.`,
    };
  }

  if (tokenRow.action !== "attendance" && tokenRow.action !== action) {
    return {
      ok: false,
      code: "biometric_action_mismatch",
      reason: `${action === "check_in" ? "Check-in" : "Check-out"} blocked · biometric verification was not issued for this action.`,
    };
  }

  // Atomically mark token as used so it can NEVER be reused
  const now = new Date().toISOString();
  const { error: markErr, data: updatedRows } = await supabase
    .from("biometric_verification_tokens")
    .update({ used_at: now })
    .eq("id", tokenRow.id)
    .is("used_at", null)
    .select("id");

  if (markErr || !updatedRows || updatedRows.length === 0) {
    return {
      ok: false,
      code: "biometric_replayed",
      reason: `${action === "check_in" ? "Check-in" : "Check-out"} blocked · token was already consumed. Please scan again.`,
    };
  }

  return {
    ok: true,
    method: tokenRow.method as "face" | "fingerprint",
    distance: tokenRow.distance != null ? Number(tokenRow.distance) : null,
  };
}

export const checkIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AttendanceCheckSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const block = async (code: any, reason: string, params: Record<string, any> = {}) => {
      await logAttendanceBio(userId, data, "check_in", false, reason);
      return { ok: false as const, blocked: true as const, code, params, reason };
    };

    const rl = await enforceAttendanceRateLimit(supabase as any, userId, "check_in");
    if (rl.limited) {
      return block(
        "rate_limited",
        `Check-in blocked · too many attempts (${rl.max} per ${rl.windowSeconds}s). Try again in ${rl.retryAfterSeconds}s.`,
        { retryAfterSeconds: rl.retryAfterSeconds, max: rl.max, windowSeconds: rl.windowSeconds }
      );
    }
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const dow = isoWeekday(today); // 0 Sun … 6 Sat, local-noon safe
    const isWeekend = dow === 5 || dow === 6; // Fri / Sat

    // 0. One check-in per day
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, in_time")
      .eq("employee_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (existing?.in_time) {
      return block("check_in_already", "Check-in blocked · you have already checked in today.");
    }

    {
      const { checkDeviceAccess } = await import("@/backend/server/device-registry.server");
      const gate = await checkDeviceAccess(userId, data.device_id, "in");
      if (!gate.ok) {
        return block("device_unauthorized", gate.reason);
      }
    }

    // Face recognition gate (verified via single-use server token)
    let bioCheck: { ok: true; method: "face" | "fingerprint" | "none"; distance: number | null };
    {
      const { data: faceRow, error: faceErr } = await (supabase as any)
        .from("profiles")
        .select("face_required")
        .eq("id", userId)
        .maybeSingle();
      const faceRequired = faceErr ? true : faceRow?.face_required !== false;
      const res = await validateAndConsumeBioToken(
        supabase,
        userId,
        data.biometric_token,
        "check_in",
        faceRequired,
      );
      if (!res.ok) {
        return block(res.code, res.reason);
      }
      bioCheck = res;
    }

    // Resolve assigned geofences + per-employee authorized networks + branch-level networks
    const [
      { data: assigns },
      { data: netAssigns },
      { data: leaveRow },
      { data: holidayRow },
      { data: profileRow },
    ] = await Promise.all([
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
      supabase.from("holidays").select("name, type").eq("date", today).maybeSingle() as any,
      supabase.from("profiles").select("approved_work_date").eq("id", userId).maybeSingle() as any,
    ]);

    const isApprovedToWork = profileRow?.approved_work_date === today;

    // 1. Approved leave
    if (leaveRow && !isApprovedToWork) {
      const raw = (leaveRow.leave_type_name ?? "").trim();
      const hasName = !!raw;
      const leaveName = raw ? (/leave$/i.test(raw) ? raw : `${raw} leave`) : "a leave day";
      const start = leaveRow.start_date ?? "";
      const end = leaveRow.end_date ?? "";
      const dateRange = start === end ? start : `${start} – ${end}`;
      return block(
        hasName ? "leave" : "leave_noname",
        `Check-in blocked · Today is ${leaveName} (${dateRange}).`,
        { action: "check_in", name: leaveName, range: dateRange }
      );
    }
    // 2. Holiday
    if (holidayRow && !isApprovedToWork) {
      return block(
        "holiday",
        `Check-in blocked · today is a holiday (${holidayRow.name}).`,
        { action: "check_in", name: holidayRow.name }
      );
    }
    // 3. Weekend (Fri/Sat)
    if (isWeekend && !isApprovedToWork) {
      return block(
        "weekend",
        "Check-in blocked · today is a weekend (Friday / Saturday).",
        { action: "check_in" }
      );
    }

    const { loadAssignedFences } = await import("@/backend/server/geofence.server");
    const { evaluatePresence, loadLastTrustedLocation, POLICY_VERSION } = await import(
      "@/backend/server/anti-spoofing.server"
    );
    const locs = (await loadAssignedFences(supabase as any, [userId])).get(userId) ?? [];

    const nets = ((netAssigns ?? []) as any[])
      .map((a) => a.networks)
      .filter((n: any) => n && n.is_active);

    const hasConstraints = locs.length > 0 || nets.length > 0;
    const freeCheck = !hasConstraints;

    // NOTE: SSID from the client is untrusted; we only use it as a supplemental
    // advisory signal — it CANNOT substitute for geofence presence.
    const onAuthorizedNetwork =
      nets.length > 0 && !!data.ssid && nets.some((n: any) => n.ssid === data.ssid);

    // ── Three-Tier Presence Decision ──────────────────────────────────────
    const lastTrusted = await loadLastTrustedLocation(supabase as any, userId);
    const presenceDecision = evaluatePresence(
      {
        lat: data.lat,
        lng: data.lng,
        accuracy_m: (data as any).accuracy_m ?? null,
        gps_age_ms: (data as any).gps_age_ms ?? null,
        gps_sample_count: (data as any).gps_sample_count ?? null,
      },
      locs,
      lastTrusted,
    );

    // Hard REJECT from presence engine (clearly outside fence)
    if (presenceDecision.outcome === "reject") {
      // Log the attempt before blocking
      await (supabase as any).from("attendance_attempts").insert({
        employee_id: userId,
        action: "check_in",
        claimed_lat: data.lat ?? null,
        claimed_lng: data.lng ?? null,
        claimed_accuracy_m: (data as any).accuracy_m ?? null,
        claimed_gps_age_ms: (data as any).gps_age_ms ?? null,
        claimed_gps_samples: (data as any).gps_sample_count ?? null,
        device_id: data.device_id ?? null,
        ssid_claimed: data.ssid ?? null,
        biometric_method: bioCheck.method,
        fence_distance_m: presenceDecision.fenceDistanceM,
        fence_allowed_m: presenceDecision.fenceAllowedM,
        fence_result: presenceDecision.fenceOutcome,
        risk_signals: presenceDecision.riskSignals,
        decision: "reject",
        reason_codes: presenceDecision.reasonCodes,
        policy_version: POLICY_VERSION,
      });
      const primaryCode = presenceDecision.reasonCodes[0] ?? "gps_outside_fence";
      const distDetail = presenceDecision.fenceDistanceM != null
        ? ` (${presenceDecision.fenceDistanceM} m away, allowed ${presenceDecision.fenceAllowedM} m)`
        : "";
      return block(
        primaryCode,
        `Check-in blocked · GPS outside your assigned work area${distDetail}.`,
        { action: "check_in", reasons: presenceDecision.reasonCodes, signals: presenceDecision.riskSignals }
      );
    }

    let city = data.city ?? null;
    let district = data.district ?? null;
    let street = data.street ?? null;

    if ((!district || !city) && data.lat != null && data.lng != null) {
      try {
        const geo = await reverseGeocodeCoords(data.lat, data.lng);
        if (!city && geo.city) city = geo.city;
        if (!district && geo.district) district = geo.district;
        if (!street && geo.street) street = geo.street;
      } catch {}
    }

    // decision is 'accept' or 'review'
    const finalDecision = presenceDecision.outcome;

    const { data: attRow, error } = await (supabase as any).from("attendance").upsert(
      {
        employee_id: userId,
        date: today,
        in_time: now,
        branch: data.branch,
        lat: data.lat,
        lng: data.lng,
        accuracy_m: (data as any).accuracy_m ?? null,
        gps_age_ms: (data as any).gps_age_ms ?? null,
        gps_sample_count: (data as any).gps_sample_count ?? null,
        network_ok: data.network_ok,
        note: data.note,
        city,
        district,
        street,
        free_check: freeCheck,
        status: "present",
        verified_face: bioCheck.method === "face",
        verified_fp: bioCheck.method === "fingerprint",
        decision: finalDecision,
        reason_codes: presenceDecision.reasonCodes.length > 0 ? presenceDecision.reasonCodes : null,
        policy_version: POLICY_VERSION,
      },
      { onConflict: "employee_id,date" },
    ).select("id").maybeSingle();
    if (error) throw new Error(error.message);

    const attendanceId = attRow?.id ?? null;

    // Log structured attempt
    await (supabase as any).from("attendance_attempts").insert({
      employee_id: userId,
      action: "check_in",
      claimed_lat: data.lat ?? null,
      claimed_lng: data.lng ?? null,
      claimed_accuracy_m: (data as any).accuracy_m ?? null,
      claimed_gps_age_ms: (data as any).gps_age_ms ?? null,
      claimed_gps_samples: (data as any).gps_sample_count ?? null,
      device_id: data.device_id ?? null,
      ssid_claimed: data.ssid ?? null,
      biometric_method: bioCheck.method,
      fence_distance_m: presenceDecision.fenceDistanceM,
      fence_allowed_m: presenceDecision.fenceAllowedM,
      fence_result: presenceDecision.fenceOutcome,
      risk_signals: presenceDecision.riskSignals,
      decision: finalDecision,
      reason_codes: presenceDecision.reasonCodes,
      policy_version: POLICY_VERSION,
      attendance_id: attendanceId,
    });

    // If REVIEW: create a review case for admin/manager triage
    if (finalDecision === "review" && attendanceId) {
      await (supabase as any).from("attendance_review_cases").insert({
        attendance_id: attendanceId,
        employee_id: userId,
        action: "check_in",
        reason_codes: presenceDecision.reasonCodes,
        risk_signals: presenceDecision.riskSignals,
        status: "pending",
      });
    }

    {
      const { touchDeviceCheck } = await import("@/backend/server/device-registry.server");
      await touchDeviceCheck(data.device_id!, "in");
    }

    await logAttendanceBio(userId, data, "check_in", true, null, bioCheck.method, bioCheck.distance);
    return {
      ok: true as const,
      blocked: false as const,
      free_check: freeCheck,
      within_geofence: presenceDecision.fenceOutcome === "inside",
      network_match: onAuthorizedNetwork,
      decision: finalDecision,
      pending_review: finalDecision === "review",
      risk_signals: presenceDecision.riskSignals,
    };
  });

export const checkOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AttendanceCheckSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const block = async (code: any, reason: string, params: Record<string, any> = {}) => {
      await logAttendanceBio(userId, data, "check_out", false, reason);
      return { ok: false as const, blocked: true as const, code, params, reason };
    };

    const rl = await enforceAttendanceRateLimit(supabase as any, userId, "check_out");
    if (rl.limited) {
      return block(
        "rate_limited",
        `Check-out blocked · too many attempts (${rl.max} per ${rl.windowSeconds}s). Try again in ${rl.retryAfterSeconds}s.`,
        { retryAfterSeconds: rl.retryAfterSeconds, max: rl.max, windowSeconds: rl.windowSeconds }
      );
    }
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const { data: row } = await supabase
      .from("attendance")
      .select("id, in_time, out_time")
      .eq("employee_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (!row?.in_time) {
      return block("check_out_not_in", "Check-out blocked · you have not checked in today.");
    }
    if (row.out_time) {
      return block("check_out_already", "Check-out blocked · you have already checked out today.");
    }

    {
      const { checkDeviceAccess } = await import("@/backend/server/device-registry.server");
      const gate = await checkDeviceAccess(userId, data.device_id, "out");
      if (!gate.ok) {
        return block("device_unauthorized", gate.reason);
      }
    }

    // Face recognition gate (verified via single-use server token)
    let bioCheckOut: { ok: true; method: "face" | "fingerprint" | "none"; distance: number | null };
    {
      const { data: faceRow, error: faceErr } = await (supabase as any)
        .from("profiles")
        .select("face_required")
        .eq("id", userId)
        .maybeSingle();
      const faceRequired = faceErr ? true : faceRow?.face_required !== false;
      const res = await validateAndConsumeBioToken(
        supabase,
        userId,
        data.biometric_token,
        "check_out",
        faceRequired,
      );
      if (!res.ok) {
        return block(res.code, res.reason);
      }
      bioCheckOut = res;
    }

    // Interlock: check if an active task or travel is in progress
    const { data: runningTasks } = await supabase
      .from("tasks")
      .select("id, title")
      .contains("assignees", [userId])
      .eq("status", "in_progress")
      .limit(1);

    if (runningTasks && runningTasks.length > 0) {
      return block(
        "active_task_in_progress",
        `You still have an active task "${runningTasks[0].title}". Please complete or close the task before signing out.`,
        { taskTitle: runningTasks[0].title }
      );
    }

    const { data: latestAct } = await supabase
      .from("task_activity")
      .select("id, kind, task_name")
      .eq("employee_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestAct && latestAct.kind === "start_trip") {
      return block(
        "active_travel_in_progress",
        `You still have an active travel session "${latestAct.task_name || "Travel"}". Please complete your travel before signing out.`,
        { travelTitle: latestAct.task_name }
      );
    }

    const dow = isoWeekday(today); // local-noon safe
    const isWeekend = dow === 5 || dow === 6;
    const [{ data: leaveRow }, { data: holidayRow }, { data: profileRow }] = await Promise.all([
      supabase
        .from("leaves")
        .select("id, leave_type_name, status, start_date, end_date")
        .eq("employee_id", userId)
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle() as any,
      supabase.from("holidays").select("name, type").eq("date", today).maybeSingle() as any,
      supabase.from("profiles").select("approved_work_date").eq("id", userId).maybeSingle() as any,
    ]);

    const isApprovedToWork = profileRow?.approved_work_date === today;

    if (leaveRow && !isApprovedToWork) {
      const raw = (leaveRow.leave_type_name ?? "").trim();
      const hasName = !!raw;
      const leaveName = raw ? (/leave$/i.test(raw) ? raw : `${raw} leave`) : "a leave day";
      const start = leaveRow.start_date ?? "";
      const end = leaveRow.end_date ?? "";
      const dateRange = start === end ? start : `${start} – ${end}`;
      return block(
        hasName ? "leave" : "leave_noname",
        `Check-out blocked · Today is ${leaveName} (${dateRange}).`,
        { action: "check_out", name: leaveName, range: dateRange }
      );
    }
    if (holidayRow && !isApprovedToWork) {
      return block(
        "holiday",
        `Check-out blocked · today is a holiday (${holidayRow.name}).`,
        { action: "check_out", name: holidayRow.name }
      );
    }
    if (isWeekend && !isApprovedToWork) {
      return block(
        "weekend",
        "Check-out blocked · today is a weekend (Friday / Saturday).",
        { action: "check_out" }
      );
    }

    let outCity = data.city ?? null;
    let outDistrict = data.district ?? null;
    let outStreet = data.street ?? null;

    if ((!outDistrict || !outCity) && data.lat != null && data.lng != null) {
      try {
        const geo = await reverseGeocodeCoords(data.lat, data.lng);
        if (!outCity && geo.city) outCity = geo.city;
        if (!outDistrict && geo.district) outDistrict = geo.district;
        if (!outStreet && geo.street) outStreet = geo.street;
      } catch {}
    }

    // Work-location gate via three-tier presence engine
    {
      const { loadAssignedFences } = await import("@/backend/server/geofence.server");
      const { evaluatePresence, loadLastTrustedLocation, POLICY_VERSION } = await import(
        "@/backend/server/anti-spoofing.server"
      );
      const fences = (await loadAssignedFences(supabase as any, [userId])).get(userId) ?? [];
      const lastTrusted = await loadLastTrustedLocation(supabase as any, userId);
      const presenceDecision = evaluatePresence(
        {
          lat: data.lat,
          lng: data.lng,
          accuracy_m: (data as any).accuracy_m ?? null,
          gps_age_ms: (data as any).gps_age_ms ?? null,
          gps_sample_count: (data as any).gps_sample_count ?? null,
        },
        fences,
        lastTrusted,
      );

      if (presenceDecision.outcome === "reject") {
        // Log the rejected attempt
        await (supabase as any).from("attendance_attempts").insert({
          employee_id: userId,
          action: "check_out",
          claimed_lat: data.lat ?? null,
          claimed_lng: data.lng ?? null,
          claimed_accuracy_m: (data as any).accuracy_m ?? null,
          claimed_gps_age_ms: (data as any).gps_age_ms ?? null,
          claimed_gps_samples: (data as any).gps_sample_count ?? null,
          device_id: data.device_id ?? null,
          ssid_claimed: data.ssid ?? null,
          biometric_method: bioCheckOut.method,
          fence_distance_m: presenceDecision.fenceDistanceM,
          fence_allowed_m: presenceDecision.fenceAllowedM,
          fence_result: presenceDecision.fenceOutcome,
          risk_signals: presenceDecision.riskSignals,
          decision: "reject",
          reason_codes: presenceDecision.reasonCodes,
          policy_version: POLICY_VERSION,
        });
        const distDetail = presenceDecision.fenceDistanceM != null
          ? ` (${presenceDecision.fenceDistanceM} m away, allowed ${presenceDecision.fenceAllowedM} m)`
          : "";
        return block(
          presenceDecision.reasonCodes[0] ?? "gps_outside_fence",
          `Check-out blocked · GPS outside your assigned work area${distDetail}.`,
          { action: "check_out", reasons: presenceDecision.reasonCodes, signals: presenceDecision.riskSignals }
        );
      }

      const outDecision = presenceDecision.outcome; // 'accept' | 'review'

      const { data: updatedRow, error } = await (supabase as any)
        .from("attendance")
        .update({
          out_time: now,
          note: data.note,
          out_lat: data.lat ?? null,
          out_lng: data.lng ?? null,
          out_city: outCity,
          out_district: outDistrict,
          out_street: outStreet,
          out_accuracy_m: (data as any).accuracy_m ?? null,
          out_gps_age_ms: (data as any).gps_age_ms ?? null,
        })
        .eq("employee_id", userId)
        .eq("date", today)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);

      const attendanceId = updatedRow?.id ?? null;

      // Log the structured attempt
      await (supabase as any).from("attendance_attempts").insert({
        employee_id: userId,
        action: "check_out",
        claimed_lat: data.lat ?? null,
        claimed_lng: data.lng ?? null,
        claimed_accuracy_m: (data as any).accuracy_m ?? null,
        claimed_gps_age_ms: (data as any).gps_age_ms ?? null,
        claimed_gps_samples: (data as any).gps_sample_count ?? null,
        device_id: data.device_id ?? null,
        ssid_claimed: data.ssid ?? null,
        biometric_method: bioCheckOut.method,
        fence_distance_m: presenceDecision.fenceDistanceM,
        fence_allowed_m: presenceDecision.fenceAllowedM,
        fence_result: presenceDecision.fenceOutcome,
        risk_signals: presenceDecision.riskSignals,
        decision: outDecision,
        reason_codes: presenceDecision.reasonCodes,
        policy_version: POLICY_VERSION,
        attendance_id: attendanceId,
      });

      if (outDecision === "review" && attendanceId) {
        await (supabase as any).from("attendance_review_cases").insert({
          attendance_id: attendanceId,
          employee_id: userId,
          action: "check_out",
          reason_codes: presenceDecision.reasonCodes,
          risk_signals: presenceDecision.riskSignals,
          status: "pending",
        });
      }

      {
        const { touchDeviceCheck } = await import("@/backend/server/device-registry.server");
        await touchDeviceCheck(data.device_id!, "out");
      }
      await logAttendanceBio(userId, data, "check_out", true, null, bioCheckOut.method, bioCheckOut.distance);
      return {
        ok: true as const,
        blocked: false as const,
        decision: outDecision,
        pending_review: outDecision === "review",
        risk_signals: presenceDecision.riskSignals,
      };
    }
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
    const { data: sh } = await (supabase
      .from("employee_shifts")
      .select("shifts(name, start_time, end_time, grace_minutes, is_overnight, is_active)")
      .eq("employee_id", userId)
      .limit(1) as any);
    const s0: any = (sh ?? [])[0]?.shifts;
    const shift = s0 && s0.is_active !== false
      ? { name: String(s0.name), start_time: String(s0.start_time).slice(0, 5), end_time: String(s0.end_time).slice(0, 5), grace_minutes: Number(s0.grace_minutes ?? 0), is_overnight: !!s0.is_overnight }
      : null;
    return { locations, networks, shift };
  });

export const listMyAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", context.userId)
      .order("date", { ascending: false })
      .limit(120);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAttendanceRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    parseInput(
      dateRangeSchema({ maxDays: 366 }).and(
        z.object({ employeeIds: z.array(z.string().uuid()).optional() }),
      ),
      i,
    ),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("attendance")
      .select("*")
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: false })
      .limit(5000);
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
  .inputValidator((i) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    try {
      const geo = await reverseGeocodeCoords(data.lat, data.lng);
      if (geo.formatted) return geo.formatted;
    } catch {
      // ignore
    }
    return "Location name unavailable";
  });

export const adminListAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    parseInput(
      dateRangeSchema({ maxDays: 366 }).and(
        z.object({ employeeIds: z.array(z.string().uuid()).optional() }),
      ),
      i,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    let q = context.supabase
      .from("attendance")
      .select(
        "id, employee_id, date, in_time, out_time, branch, status, note, city, district, street, free_check, lat, lng, out_lat, out_lng, out_city, out_district, out_street, decision, reason_codes, accuracy_m, out_accuracy_m, profiles:employee_id(full_name, email)",
      )
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: false })
      .limit(5000);
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
      decision: (r.decision ?? "accept") as "accept" | "review" | "reject",
      reason_codes: (r.reason_codes ?? null) as string[] | null,
      accuracy_m: (r.accuracy_m ?? null) as number | null,
      out_accuracy_m: (r.out_accuracy_m ?? null) as number | null,
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
      .select("id")
      .single();
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
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id as string,
      name: (r.full_name ?? r.email ?? r.id) as string,
    }));
  });

export type CheckValidationRow = {
  id: string;
  date: string;
  in_time: string | null;
  out_time: string | null;
  free_check: boolean;
  in_geofence: { ok: boolean; name: string | null; distance_m: number | null; allowed_m: number | null } | null;
  out_geofence: { ok: boolean; name: string | null; distance_m: number | null; allowed_m: number | null } | null;
  network_ok: boolean | null;
  in_place: string | null;
  out_place: string | null;
};

/**
 * Per-employee geofence + network validation history for recent check-ins and
 * check-outs, recomputed against the employee's current assignments.
 */
export const listMyCheckValidations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => parseInput(z.object({ limit: z.number().int().min(1).max(90).optional() }), i ?? {}))
  .handler(async ({ data, context }): Promise<CheckValidationRow[]> => {
    const { supabase, userId } = context;
    const limit = data.limit ?? 30;

    const [{ data: rows, error }, { data: assigns }] = await Promise.all([
      supabase
        .from("attendance")
        .select("id, date, in_time, out_time, lat, lng, out_lat, out_lng, network_ok, free_check, city, district, street, out_city, out_district, out_street")
        .eq("employee_id", userId)
        .order("date", { ascending: false })
        .limit(limit),
      supabase
        .from("geofence_assignments")
        .select("geofence_locations(id, name, lat, lng, radius_m, active)")
        .eq("profile_id", userId) as any,
    ]);
    if (error) throw new Error(error.message);

    const locs = ((assigns ?? []) as any[])
      .map((a) => a.geofence_locations)
      .filter((l: any) => l && l.active);

    const evaluate = (lat: number | null, lng: number | null) => {
      if (locs.length === 0 || lat == null || lng == null) return null;
      let best: { ok: boolean; name: string | null; distance_m: number; allowed_m: number } | null = null;
      for (const l of locs as any[]) {
        const d = distMeters(Number(lat), Number(lng), Number(l.lat), Number(l.lng));
        const r = Number(l.radius_m ?? 100);
        if (!best || d < best.distance_m) {
          best = { ok: d <= r, name: l.name ?? null, distance_m: Math.round(d), allowed_m: r };
        }
      }
      return best;
    };
    const place = (city: any, district: any, street: any) =>
      [street, district, city].filter(Boolean).join(", ") || null;

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      date: r.date,
      in_time: r.in_time ?? null,
      out_time: r.out_time ?? null,
      free_check: !!r.free_check,
      in_geofence: evaluate(r.lat, r.lng),
      out_geofence: evaluate(r.out_lat, r.out_lng),
      network_ok: r.network_ok ?? null,
      in_place: place(r.city, r.district, r.street),
      out_place: place(r.out_city, r.out_district, r.out_street),
    }));
  });

// ── Printable attendance report grouped by department ─────────────────────
export type AttendanceReportRow = {
  employee_id: string;
  employee_name: string;
  emp_code: string | null;
  department: string;
  date: string;
  in_time: string | null;
  out_time: string | null;
  status: string;
  branch: string | null;
  device_status: string;
  in_location: string | null;
  in_location_ok: boolean | null;
  out_location: string | null;
  out_location_ok: boolean | null;
  free_check?: boolean;
};

function resolvePlaceName(...parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed || /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(trimmed) || /^-?\d{1,3}(?:\.\d+)?$/.test(trimmed)) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    cleaned.push(trimmed);
  }
  return cleaned.join(", ") || null;
}

export const adminAttendanceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    parseInput(
      dateRangeSchema().and(z.object({ onlyApprovedLocations: z.boolean().optional() })),
      i,
    ),
  )
  .handler(async ({ data, context }): Promise<AttendanceReportRow[]> => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("attendance")
      .select("employee_id, date, in_time, out_time, status, branch, lat, lng, out_lat, out_lng, city, district, street, out_city, out_district, out_street, free_check")
      .gte("date", data.from).lte("date", data.to)
      .order("date", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.employee_id)));
    if (!ids.length) return [];

    const { loadAssignedFences, evaluateFence } = await import("@/backend/server/geofence.server");
    const [{ data: profs }, { data: devices }, fenceMap, { data: activeLocs }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, email, emp_code, departments:department_id(name_en)")
        .in("id", ids),
      context.supabase.from("employee_devices").select("user_id, status").in("user_id", ids),
      loadAssignedFences(context.supabase as any, ids),
      context.supabase
        .from("geofence_locations")
        .select("id, name, lat, lng, radius_m, active")
        .eq("active", true),
    ]);

    const companyFences = ((activeLocs ?? []) as any[]).map((l) => ({
      id: l.id as string,
      name: (l.name ?? "Work location") as string,
      lat: Number(l.lat),
      lng: Number(l.lng),
      radius_m: Number(l.radius_m ?? 100),
    }));

    const pMap = new Map<string, any>(((profs ?? []) as any[]).map((p) => [p.id, p]));
    const dMap = new Map<string, string>();
    for (const d of ((devices ?? []) as any[])) {
      const prev = dMap.get(d.user_id);
      if (!prev || d.status === "approved") dMap.set(d.user_id, d.status);
    }

    const mapped: AttendanceReportRow[] = list.map((r) => {
      const p = pMap.get(r.employee_id);
      const assignedFences = fenceMap.get(r.employee_id) ?? [];
      const effectiveFences = assignedFences.length > 0 ? assignedFences : companyFences;
      const isFreeCheck = !!r.free_check;

      const inPlace = resolvePlaceName(r.street, r.district, r.city);
      const outPlace = resolvePlaceName(r.out_street, r.out_district, r.out_city);

      // In-punch fence check
      let inFence =
        r.in_time && r.lat != null && r.lng != null
          ? evaluateFence(effectiveFences, r.lat, r.lng)
          : null;
      let inLocationName: string | null = null;
      let inLocationOk: boolean | null = null;
      if (r.in_time) {
        if (isFreeCheck) {
          inLocationName = inPlace || inFence?.name || r.branch || "HQ";
          inLocationOk = true;
        } else if (inFence) {
          inLocationOk = inFence.ok;
          inLocationName = inPlace || inFence.name || r.branch || "HQ";
        } else {
          inLocationName = inPlace || r.branch || "HQ";
          inLocationOk = true;
        }
      }

      // Out-punch fence check
      let outFence =
        r.out_time && r.out_lat != null && r.out_lng != null
          ? evaluateFence(effectiveFences, r.out_lat, r.out_lng)
          : null;
      let outLocationName: string | null = null;
      let outLocationOk: boolean | null = null;
      if (r.out_time) {
        if (isFreeCheck) {
          outLocationName = outPlace || outFence?.name || r.branch || "HQ";
          outLocationOk = true;
        } else if (outFence) {
          outLocationOk = outFence.ok;
          outLocationName = outPlace || outFence.name || r.branch || "HQ";
        } else {
          outLocationName = outPlace || r.branch || "HQ";
          outLocationOk = true;
        }
      }

      return {
        employee_id: r.employee_id as string,
        employee_name: (p?.full_name ?? p?.email ?? r.employee_id) as string,
        emp_code: (p?.emp_code ?? null) as string | null,
        department: (p?.departments?.name_en ?? "Unassigned") as string,
        date: r.date as string,
        in_time: r.in_time as string | null,
        out_time: r.out_time as string | null,
        status: (r.status ?? "—") as string,
        branch: (r.branch ?? null) as string | null,
        device_status: dMap.get(r.employee_id) ?? "none",
        in_location: inLocationName,
        in_location_ok: inLocationOk,
        out_location: outLocationName,
        out_location_ok: outLocationOk,
        free_check: isFreeCheck,
      };
    });

    if (!data.onlyApprovedLocations) return mapped;
    // Strict: keep a punch only when it was verified inside an active work
    // location (or was an admin-granted free check). Punches with no GPS or
    // no matching location are dropped instead of defaulting to "inside".
    const strictOk = (lat: any, lng: any, fences: any[]) =>
      lat != null && lng != null && fences.length > 0 && !!evaluateFence(fences, lat, lng)?.ok;
    return mapped
      .map((r, i) => {
        const src = list[i];
        const assigned = fenceMap.get(src.employee_id) ?? [];
        const fences = assigned.length > 0 ? assigned : companyFences;
        const inOk = r.free_check || strictOk(src.lat, src.lng, fences);
        const outOk = r.free_check || strictOk(src.out_lat, src.out_lng, fences);
        return {
          ...r,
          in_time: inOk ? r.in_time : null,
          in_location_ok: inOk ? r.in_location_ok : null,
          out_time: outOk ? r.out_time : null,
          out_location_ok: outOk ? r.out_location_ok : null,
        };
      })
      .filter((r) => r.in_time || r.out_time);
  });

async function assertAdminHrOrManager(supabase: any, userId: string): Promise<"admin" | "hr" | "manager"> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const userRoles = (roles ?? []).map((r: any) => r.role);
  if (userRoles.includes("admin")) return "admin";
  if (userRoles.includes("hr")) return "hr";
  if (userRoles.includes("manager")) return "manager";
  throw new Error("Forbidden");
}

export const listAttendanceReviewCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      status: z.enum(["pending", "approved", "rejected", "all"]).optional().default("pending"),
    }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const role = await assertAdminHrOrManager(context.supabase, context.userId);
    let q = (context.supabase as any)
      .from("attendance_review_cases")
      .select(
        "id, attendance_id, employee_id, action, reason_codes, risk_signals, status, reviewer_id, reviewer_note, created_at, resolved_at, profiles:employee_id(full_name, email, emp_code, manager_id), attendance:attendance_id(date, in_time, out_time, branch, lat, lng, accuracy_m, out_lat, out_lng, out_accuracy_m)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status !== "all") {
      q = q.eq("status", data.status);
    }

    if (role === "manager") {
      const { data: reports } = await (context.supabase as any)
        .from("profiles")
        .select("id")
        .eq("manager_id", context.userId);
      const reportIds = (reports ?? []).map((p: any) => p.id);
      if (!reportIds.length) return [];
      q = q.in("employee_id", reportIds);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const resolveAttendanceReviewCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      caseId: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const role = await assertAdminHrOrManager(context.supabase, context.userId);
    const { data: caseRow, error: fetchErr } = await (context.supabase as any)
      .from("attendance_review_cases")
      .select("id, attendance_id, employee_id, status")
      .eq("id", data.caseId)
      .maybeSingle();

    if (fetchErr || !caseRow) throw new Error("Review case not found");

    if (role === "manager") {
      const { data: empProfile } = await (context.supabase as any)
        .from("profiles")
        .select("manager_id")
        .eq("id", caseRow.employee_id)
        .maybeSingle();
      if (empProfile?.manager_id !== context.userId) {
        throw new Error("Forbidden: You are not the line manager for this employee.");
      }
    }

    const now = new Date().toISOString();
    const { error: updErr } = await (context.supabase as any)
      .from("attendance_review_cases")
      .update({
        status: data.decision,
        reviewer_id: context.userId,
        reviewer_note: data.note?.trim() || null,
        resolved_at: now,
      })
      .eq("id", data.caseId);

    if (updErr) throw new Error(updErr.message);

    const attDecision = data.decision === "approved" ? "accept" : "reject";
    await (context.supabase as any)
      .from("attendance")
      .update({ decision: attDecision })
      .eq("id", caseRow.attendance_id);

    return { ok: true, caseId: data.caseId, status: data.decision };
  });

