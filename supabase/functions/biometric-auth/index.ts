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

    if (action === "face-login") {
      const email = String(body.email || "").trim().toLowerCase();
      const descriptor = body.descriptor;
      const userAgent = body.userAgent || req.headers.get("user-agent") || null;
      const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

      if (!email || !Array.isArray(descriptor) || descriptor.length !== 128) {
        return json(400, { ok: false, error: "Invalid email or 128-float vector descriptor" });
      }

      // 1. Find profile
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

      // 2. Fetch face descriptor
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

      // 3. Compare distance
      const dist = distance(faceRow.descriptor as number[], descriptor);
      if (dist > FACE_THRESHOLD) {
        await supabaseAdmin.from("biometric_audit_log").insert({
          user_id: profile.id, email, method: "face", event: "login", success: false,
          reason: `Face did not match (distance ${dist.toFixed(3)})`, distance: dist,
          user_agent: userAgent, ip_address: ipAddress,
        });
        return json(400, { ok: false, error: `Face did not match (distance ${dist.toFixed(3)})`, distance: dist });
      }

      // 4. Generate link & verify OTP
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

    return json(400, { ok: false, error: "Unknown action" });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal server error" });
  }
});
