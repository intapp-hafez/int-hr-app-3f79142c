/**
 * INT-HR — Complete Android Client Service SDK
 * Direct, production-ready TypeScript functions for the Capacitor React app.
 */

import { supabase } from "./supabase.client";

// ── 1. Authentication ────────────────────────────────────────────────────────

export async function loginWithPassword(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: pass,
  });
  if (error) throw error;

  // Active status defense
  const { data: profile } = await supabase
    .from("profiles")
    .select("status, inactive_reason")
    .eq("id", data.user.id)
    .single();

  if (profile?.status === "Inactive") {
    await supabase.auth.signOut();
    throw new Error(`Account is inactive${profile.inactive_reason ? `: ${profile.inactive_reason}` : ""}`);
  }

  return data.session;
}

export async function loginWithFaceDescriptor(email: string, descriptor: number[]) {
  // Invokes the deployed Supabase Edge Function with service_role privileges
  const { data, error } = await supabase.functions.invoke("biometric-auth", {
    body: {
      action: "face-login",
      email: email.trim().toLowerCase(),
      descriptor,
      userAgent: navigator.userAgent,
    },
  });

  if (error) throw new Error(error.message || "Failed to call biometric edge function");
  if (!data?.ok || !data?.session) throw new Error(data?.error || "Face verification failed");

  // Set the session into the Supabase client
  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return data.session;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getMe() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const [{ data: profile, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (pErr) throw pErr;
  if (rErr) throw rErr;

  return {
    profile,
    roles: (roles ?? []).map((r) => r.role),
  };
}

export async function getMyProfileDetails() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: p, error } = await supabase
    .from("profiles")
    .select("id, emp_code, full_name, phone, email, national_id, department_id, position_id, manager_id, salary_mode, salary_gross, salary_net, contract_type, contract_start_date, contract_end_date, contract_cancelled, annual_advance_limit, face_required, device_check_required")
    .eq("id", userId)
    .single();

  if (error) throw error;

  const [{ data: dept }, { data: pos }, { data: mgr }] = await Promise.all([
    p.department_id
      ? supabase.from("departments").select("name_en, name_ar").eq("id", p.department_id).maybeSingle()
      : Promise.resolve({ data: null }),
    p.position_id
      ? supabase.from("positions").select("name_en, name_ar").eq("id", p.position_id).maybeSingle()
      : Promise.resolve({ data: null }),
    p.manager_id
      ? supabase.from("profiles").select("full_name").eq("id", p.manager_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...p,
    department_name: dept?.name_en || null,
    position_name: pos?.name_en || null,
    manager_name: mgr?.full_name || null,
  };
}

// ── 2. Device Registration ───────────────────────────────────────────────────

export async function registerDevice(input: {
  deviceId: string;
  deviceName: string;
  deviceType?: string;
}) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("employee_devices")
    .upsert(
      {
        employee_id: userId,
        device_id: input.deviceId,
        device_name: input.deviceName,
        device_type: input.deviceType || "mobile",
        user_agent: navigator.userAgent,
        last_ip: null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,device_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMyDevices() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("employee_devices")
    .select("*")
    .eq("employee_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ── 3. Face Biometrics & Verification Tokens ─────────────────────────────────

export async function verifyFaceAndGetToken(input: {
  descriptor: number[];
  action?: "check_in" | "check_out" | "attendance";
  lat?: number;
  lng?: number;
  accuracy_m?: number;
}) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  // Fetch stored face template
  const { data: faceRow, error: fErr } = await supabase
    .from("face_descriptors")
    .select("descriptor")
    .eq("user_id", userId)
    .maybeSingle();

  if (fErr) throw fErr;
  if (!faceRow?.descriptor) {
    throw new Error("No face registered for this account. Please enroll your face first.");
  }

  // Calculate Euclidean distance (threshold = 0.5)
  const stored = faceRow.descriptor as number[];
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = stored[i] - input.descriptor[i];
    sum += diff * diff;
  }
  const dist = Math.sqrt(sum);

  if (dist > 0.5) {
    throw new Error(`Face verification failed (similarity distance: ${dist.toFixed(3)}, threshold: 0.50)`);
  }

  // Generate single-use token valid for 2 minutes
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  const { error: insErr } = await supabase
    .from("biometric_verification_tokens")
    .insert({
      user_id: userId,
      token,
      action: input.action || "attendance",
      method: "face",
      distance: dist,
      expires_at: expiresAt,
      snapshot_lat: input.lat ?? null,
      snapshot_lng: input.lng ?? null,
      snapshot_accuracy_m: input.accuracy_m ?? null,
      snapshot_at: new Date().toISOString(),
    });

  if (insErr) throw insErr;

  return { verified: true, token, distance: dist };
}

// ── 4. Attendance (Punch In / Punch Out) ──────────────────────────────────────

export interface PunchInput {
  branch?: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
  gps_age_ms?: number;
  gps_sample_count?: number;
  deviceId: string;
  biometricToken?: string;
  note?: string;
  altitude?: number;
  speed?: number;
}

export async function punchIn(input: PunchInput) {
  // If your project executes attendance via start-shim, call checkIn from attendance.functions:
  const { checkIn } = await import("@/backend/functions/attendance.functions");
  return await checkIn({
    data: {
      branch: input.branch || "HQ",
      lat: input.lat,
      lng: input.lng,
      accuracy_m: input.accuracy_m,
      gps_age_ms: input.gps_age_ms,
      gps_sample_count: input.gps_sample_count,
      device_id: input.deviceId,
      biometric_token: input.biometricToken,
      biometric_method: "face",
      note: input.note,
      altitude: input.altitude,
      speed: input.speed,
    },
  });
}

export async function punchOut(input: PunchInput) {
  const { checkOut } = await import("@/backend/functions/attendance.functions");
  return await checkOut({
    data: {
      branch: input.branch || "HQ",
      lat: input.lat,
      lng: input.lng,
      accuracy_m: input.accuracy_m,
      gps_age_ms: input.gps_age_ms,
      gps_sample_count: input.gps_sample_count,
      device_id: input.deviceId,
      biometric_token: input.biometricToken,
      biometric_method: "face",
      note: input.note,
      altitude: input.altitude,
      speed: input.speed,
    },
  });
}

export async function getMyAttendanceHistory() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("employee_id", userId)
    .order("date", { ascending: false })
    .limit(60);

  if (error) throw error;
  return data;
}

// ── 5. Leaves & Balances ─────────────────────────────────────────────────────

export async function getMyLeaveBalances() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("leave_balances")
    .select("id, leave_type_id, total_allowed, used_days, leave_types(id, name, is_paid, max_days, requires_proof)")
    .eq("employee_id", userId);

  if (error) throw error;
  return data;
}

export async function submitLeaveRequest(input: {
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  days: number;
  reason?: string;
  proofUrl?: string; // Base64 data URL up to 1.5MB
  proofMime?: string;
  proofName?: string;
}) {
  const { submitLeave } = await import("@/backend/functions/leaves.functions");
  return await submitLeave({
    data: {
      leave_type_id: input.leaveTypeId,
      start_date: input.startDate,
      end_date: input.endDate,
      days: input.days,
      reason: input.reason,
      proof_url: input.proofUrl,
      proof_mime: input.proofMime,
      proof_name: input.proofName,
      paid: true,
    },
  });
}

// ── 6. Salary Advances ───────────────────────────────────────────────────────

export async function submitAdvanceRequest(input: {
  requestedAmount: number;
  reason: string;
  expectedDate?: string;
  currency?: string;
}) {
  const { createAdvanceRequest } = await import("@/backend/functions/advances.functions");
  return await createAdvanceRequest({
    data: {
      requested_amount: input.requestedAmount,
      reason: input.reason,
      expected_date: input.expectedDate,
      currency: input.currency || "EGP",
    },
  });
}

export async function getMyAdvances() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("employee_advances")
    .select("*")
    .eq("employee_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ── 7. Hourly Permissions ────────────────────────────────────────────────────

export async function submitPermissionRequest(input: {
  permissionType: "personal" | "work";
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  reason: string;
}) {
  const { requestPermission } = await import("@/backend/functions/employee-permissions.functions");
  return await requestPermission({
    data: {
      permission_type: input.permissionType,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      reason: input.reason,
    },
  });
}

// ── 8. Tasks & Chat ──────────────────────────────────────────────────────────

export async function getMyTasks() {
  const { listTasks } = await import("@/backend/functions/tasks.functions");
  return await listTasks();
}

export async function getMyChatChannels() {
  const { listMyChannels } = await import("@/backend/functions/chat.functions");
  return await listMyChannels();
}

export async function sendChatMessage(channelId: string, content: string) {
  const { sendMessage } = await import("@/backend/functions/chat.functions");
  return await sendMessage({
    data: {
      channelId,
      content,
    },
  });
}
