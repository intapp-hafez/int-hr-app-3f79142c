// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function isValidDescriptor(arr: unknown): arr is number[] {
  if (!Array.isArray(arr) || arr.length !== 128) return false;
  for (let i = 0; i < 128; i++) {
    const val = arr[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      return false;
    }
  }
  return true;
}

function distance(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

const FACE_THRESHOLD = 0.5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const body = await req.json();
    const action = body.action;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { ok: false, error: "Server missing Supabase service configuration" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. FACE LOGIN (Anonymous -> Mints Session) ─────────────────────────
    if (action === "face-login") {
      const email = String(body.email || "").trim().toLowerCase();
      const descriptor = body.descriptor;
      const userAgent = body.userAgent || req.headers.get("user-agent") || null;
      const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

      if (!email || !isValidDescriptor(descriptor)) {
        return json(400, { ok: false, error: "Invalid email or 128-float finite vector descriptor (NaN/Infinity rejected)" });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, status")
        .ilike("email", email)
        .maybeSingle();

      if (!profile) {
        await supabaseAdmin.from("biometric_audit_log").insert({
          email, method: "face", event: "login", success: false, reason: "No account for this email",
          user_agent: userAgent, ip_address: ipAddress,
        });
        return json(400, { ok: false, error: "No account for this email" });
      }

      if (profile.status === "Inactive") {
        await supabaseAdmin.from("biometric_audit_log").insert({
          user_id: profile.id, email, method: "face", event: "login", success: false,
          reason: "This account is inactive. Please contact your administrator.",
          user_agent: userAgent, ip_address: ipAddress,
        });
        return json(400, { ok: false, error: "This account is inactive. Please contact your administrator." });
      }

      const { data: faceRow } = await supabaseAdmin
        .from("face_descriptors")
        .select("descriptor")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!faceRow?.descriptor || !Array.isArray(faceRow.descriptor)) {
        await supabaseAdmin.from("biometric_audit_log").insert({
          user_id: profile.id, email, method: "face", event: "login", success: false,
          reason: "Face not enrolled for this account",
          user_agent: userAgent, ip_address: ipAddress,
        });
        return json(400, { ok: false, error: "Face not enrolled for this account" });
      }

      const dist = distance(faceRow.descriptor as number[], descriptor);
      if (dist > FACE_THRESHOLD) {
        await supabaseAdmin.from("biometric_audit_log").insert({
          user_id: profile.id, email, method: "face", event: "login", success: false,
          reason: `Face did not match (distance ${dist.toFixed(3)})`, distance: dist,
          user_agent: userAgent, ip_address: ipAddress,
        });
        return json(400, { ok: false, error: `Face did not match (distance ${dist.toFixed(3)})`, distance: dist });
      }

      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (linkErr || !linkData?.properties?.email_otp) {
        return json(500, { ok: false, error: linkErr?.message || "Failed to generate login session" });
      }

      const otp = linkData.properties.email_otp;
      const { data: verifyData, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
        type: "magiclink",
        email,
        token: otp,
      });

      if (verifyErr || !verifyData?.session) {
        return json(500, { ok: false, error: verifyErr?.message || "Failed to mint login session" });
      }

      await supabaseAdmin.from("biometric_audit_log").insert({
        user_id: profile.id, email, method: "face", event: "login", success: true,
        distance: dist, user_agent: userAgent, ip_address: ipAddress,
      });

      return json(200, { ok: true, session: verifyData.session, distance: dist });
    }

    // ── 2. TRUSTED ATTENDANCE TOKEN ISSUANCE (Authenticated User) ───────────
    if (action === "verify-face-attendance") {
      // Resolve caller identity from Bearer token
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) {
        return json(401, { ok: false, error: "Missing Bearer authorization token" });
      }

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser?.user) {
        return json(401, { ok: false, error: "Invalid authorization token" });
      }
      const userId = authUser.user.id;

      const descriptor = body.descriptor;
      if (!isValidDescriptor(descriptor)) {
        return json(400, {
          ok: false,
          error: "Invalid face descriptor vector: must be an array of exactly 128 finite numbers. NaN and Infinity are strictly rejected.",
        });
      }

      // Check account status
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, status")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.status === "Inactive") {
        return json(403, { ok: false, error: "Account is inactive" });
      }

      // Server loads the face template — client NEVER receives it
      const { data: faceRow, error: faceErr } = await supabaseAdmin
        .from("face_descriptors")
        .select("descriptor")
        .eq("user_id", userId)
        .maybeSingle();

      if (faceErr || !faceRow?.descriptor) {
        return json(400, { ok: false, error: "Face not enrolled. Please enroll your face first." });
      }

      const stored = faceRow.descriptor as number[];
      const dist = distance(stored, descriptor);

      if (dist > FACE_THRESHOLD) {
        await supabaseAdmin.from("biometric_audit_log").insert({
          user_id: userId,
          method: "face",
          event: "verify",
          success: false,
          distance: dist,
          reason: `Distance ${dist.toFixed(3)} above threshold ${FACE_THRESHOLD}`,
        });
        return json(400, { ok: false, error: `Face did not match (similarity distance ${dist.toFixed(3)} > ${FACE_THRESHOLD})`, distance: dist });
      }

      // Generate single-use server-controlled token
      const verificationToken = crypto.randomUUID();
      // Server clock controls expiry strictly (+ 2 minutes)
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      const attendanceAction = body.attendanceAction || "attendance";
      const { error: insErr } = await supabaseAdmin
        .from("biometric_verification_tokens")
        .insert({
          user_id: userId,
          token: verificationToken,
          action: attendanceAction,
          method: "face",
          distance: dist,
          expires_at: expiresAt,
          snapshot_lat: typeof body.lat === "number" ? body.lat : null,
          snapshot_lng: typeof body.lng === "number" ? body.lng : null,
          snapshot_accuracy_m: typeof body.accuracy_m === "number" ? body.accuracy_m : null,
          snapshot_at: new Date().toISOString(),
        });

      if (insErr) {
        return json(500, { ok: false, error: `Failed to issue verification token: ${insErr.message}` });
      }

      await supabaseAdmin.from("biometric_audit_log").insert({
        user_id: userId,
        method: "face",
        event: "verify",
        success: true,
        distance: dist,
      });

      return json(200, {
        ok: true,
        verified: true,
        token: verificationToken,
        distance: dist,
        expires_at: expiresAt,
      });
    }

    return json(400, { ok: false, error: "Unknown action" });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal server error" });
  }
});
