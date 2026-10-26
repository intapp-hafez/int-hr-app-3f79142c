/**
 * INT-HR — Hardened Android Client SDK
 * Production-ready TypeScript service implementing all security and validation fixes.
 */

import { supabase } from "@/integrations/supabase/client";

// ── 0. Vector Validation Helper ──────────────────────────────────────────────

export function validateFaceDescriptor(descriptor: unknown): descriptor is number[] {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return false;
  }
  for (let i = 0; i < 128; i++) {
    const val = descriptor[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      return false;
    }
  }
  return true;
}

// ── 1. Authentication & Session Lifecycle ────────────────────────────────────

/**
 * Signs in using email and password.
 * Guarantees that inactive accounts or profiles with read errors are immediately signed out.
 */
export async function loginWithPassword(email: string, pass: string) {
  const cleanEmail = email.trim().toLowerCase();
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: pass,
  });

  if (authErr) {
    throw authErr;
  }

  if (!authData?.user?.id) {
    await supabase.auth.signOut();
    throw new Error("Authentication failed: No user ID returned");
  }

  // Strict profile verification: must be loaded and confirmed "Active"
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("status, inactive_reason, full_name")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profErr || !profile) {
    await supabase.auth.signOut();
    throw new Error(
      profErr
        ? `Failed to verify profile status: ${profErr.message}`
        : "Login rejected: Employee profile not found."
    );
  }

  if (profile.status !== "Active") {
    await supabase.auth.signOut();
    const reason = profile.inactive_reason ? ` (${profile.inactive_reason})` : "";
    throw new Error(`Account is inactive${reason}. Please contact your administrator.`);
  }

  return authData.session;
}

/**
 * Signs in using face biometric vector via the secure Edge Function.
 * The server verifies the embedding and mints an authentic JWT session.
 */
export async function loginWithFaceDescriptor(email: string, descriptor: unknown) {
  if (!validateFaceDescriptor(descriptor)) {
    throw new Error("Invalid face descriptor: must be an array of exactly 128 finite numbers. NaN and Infinity are strictly rejected.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.functions.invoke("biometric-auth", {
    body: {
      action: "face-login",
      email: cleanEmail,
      descriptor,
      userAgent: navigator.userAgent,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to reach biometric authentication service");
  }

  if (!data?.ok || !data?.session) {
    throw new Error(data?.error || "Face verification failed");
  }

  // Explicitly check for setSession errors
  const { data: setSessionData, error: setSessionErr } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (setSessionErr || !setSessionData.session) {
    throw new Error(`Failed to activate session: ${setSessionErr?.message || "Invalid session data"}`);
  }

  return setSessionData.session;
}

/**
 * Refreshes the active session.
 */
export async function refreshActiveSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data.session;
}

/**
 * Signs out and invalidates the session in storage.
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Updates the user's password.
 */
export async function changePassword(newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data.user;
}

/**
 * Triggers a password reset email.
 */
export async function requestPasswordReset(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
  if (error) throw error;
  return data;
}

// ── 2. Trusted Face Verification for Attendance ──────────────────────────────

/**
 * Verifies face biometrics via the server Edge Function.
 * The client NEVER reads the face template from the database, and cannot mint its own token.
 */
export async function verifyFaceAndGetToken(input: {
  descriptor: unknown;
  action?: "check_in" | "check_out" | "attendance";
  lat?: number;
  lng?: number;
  accuracy_m?: number;
}) {
  if (!validateFaceDescriptor(input.descriptor)) {
    throw new Error("Invalid face descriptor: must be an array of exactly 128 finite numbers. NaN/Infinity are rejected.");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Unauthorized: Please sign in before performing biometric verification.");
  }

  const { data, error } = await supabase.functions.invoke("biometric-auth", {
    body: {
      action: "verify-face-attendance",
      descriptor: input.descriptor,
      attendanceAction: input.action || "attendance",
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      accuracy_m: input.accuracy_m ?? null,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to reach trusted face verification service");
  }

  if (!data?.ok || !data?.token) {
    throw new Error(data?.error || "Face verification failed");
  }

  return {
    verified: true,
    token: data.token as string,
    distance: data.distance as number,
    expiresAt: data.expires_at as string,
  };
}

// ── 3. Passkey / WebAuthn Operations ─────────────────────────────────────────

export async function registerPasskey(label?: string) {
  const { webauthnRegisterOptions, webauthnRegisterVerify } = await import(
    "@/backend/functions/biometrics.functions"
  );
  const { startRegistration } = await import("@simplewebauthn/browser");

  const options = await webauthnRegisterOptions({ data: { label } });
  const attestation = await startRegistration({ optionsJSON: options as any });
  const res = await webauthnRegisterVerify({ data: { response: attestation, label } });
  return res;
}

export async function loginWithPasskey(email: string) {
  const { webauthnAuthOptions, webauthnAuthVerify } = await import(
    "@/backend/functions/biometrics.functions"
  );
  const { startAuthentication } = await import("@simplewebauthn/browser");

  const options = await webauthnAuthOptions({ data: { email: email.trim().toLowerCase() } });
  const assertion = await startAuthentication({ optionsJSON: options as any });
  const session = await webauthnAuthVerify({
    data: { email: email.trim().toLowerCase(), response: assertion },
  });

  if (session?.access_token) {
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw error;
  }

  return session;
}

export async function listPasskeys() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("webauthn_credentials")
    .select("id, credential_id, device_label, created_at, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function deletePasskey(credentialId: string) {
  const { deleteWebauthnCredential } = await import(
    "@/backend/functions/biometrics.functions"
  );
  return await deleteWebauthnCredential({ data: { id: credentialId } });
}

// ── 4. Attendance (Punch In / Punch Out) ──────────────────────────────────────

export interface PunchPayload {
  branch?: string;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  gps_age_ms?: number | null;
  gps_sample_count?: number | null;
  deviceId: string;
  biometricToken?: string | null;
  note?: string;
  altitude?: number | null;
  speed?: number | null;
}

export async function submitPunchIn(input: PunchPayload) {
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

export async function submitPunchOut(input: PunchPayload) {
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

// ── 5. Leaves & Balances ─────────────────────────────────────────────────────

export async function submitLeave(input: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  proofUrl?: string | null;
  proofMime?: string | null;
  proofName?: string | null;
}) {
  const { submitLeave: callSubmit } = await import("@/backend/functions/leaves.functions");
  return await callSubmit({
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

// ── 6. Advances ──────────────────────────────────────────────────────────────

export async function submitAdvance(input: {
  requestedAmount: number;
  reason: string;
  expectedDate?: string | null;
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
