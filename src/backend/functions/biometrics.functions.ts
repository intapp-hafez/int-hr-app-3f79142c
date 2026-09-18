import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logBiometricEvent } from "@/backend/server/biometric-audit.server";

// ── Face descriptors ─────────────────────────────────────
const DescriptorSchema = z.object({
  descriptor: z.array(z.number()).length(128),
});

function distance(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

const FACE_THRESHOLD = 0.5;

export const enrollFace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => DescriptorSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("face_descriptors")
      .upsert({ user_id: context.userId, descriptor: data.descriptor as any });
    await logBiometricEvent({
      userId: context.userId, method: "face", event: "enroll",
      success: !error, reason: error?.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("face_descriptors")
      .delete()
      .eq("user_id", context.userId);
    await logBiometricEvent({
      userId: context.userId, method: "face", event: "unenroll",
      success: !error, reason: error?.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyFace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => DescriptorSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("face_descriptors")
      .select("descriptor")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      await logBiometricEvent({
        userId: context.userId, method: "face", event: "verify",
        success: false, reason: "Face not enrolled",
      });
      return { match: false, enrolled: false, distance: null as number | null };
    }
    const stored = row.descriptor as unknown as number[];
    const d = distance(stored, data.descriptor);
    const match = d <= FACE_THRESHOLD;
    await logBiometricEvent({
      userId: context.userId, method: "face", event: "verify",
      success: match, distance: d,
      reason: match ? null : `Distance ${d.toFixed(3)} above threshold ${FACE_THRESHOLD}`,
    });
    return { match, enrolled: true, distance: d };
  });

// Used during login: scope the lookup by an email the user types
export const getFaceDescriptorForLogin = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ email: z.string().email() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", data.email.trim())
      .maybeSingle();
    if (!profile) return { enrolled: false, descriptor: null as number[] | null };
    const { data: row } = await supabaseAdmin
      .from("face_descriptors")
      .select("descriptor")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!row) return { enrolled: false, descriptor: null };
    return { enrolled: true, descriptor: row.descriptor as unknown as number[] };
  });

// Login: receive descriptor + email, verify match, mint session
export const faceLogin = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      email: z.string().email(),
      descriptor: z.array(z.number()).length(128),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();

    // 1. Try local dev server endpoint (/api/biometrics/face-login)
    try {
      const res = await fetch("/api/biometrics/face-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          descriptor: data.descriptor,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        if (res.ok && json?.session) {
          return json.session;
        }
        if (json?.error) {
          throw new Error(json.error);
        }
      }
    } catch (apiErr: any) {
      // If server returned a business logic error (e.g., "No account for this email" or "Face did not match"), re-throw it
      const msg = String(apiErr?.message || "");
      if (
        msg &&
        !msg.includes("Failed to fetch") &&
        !msg.includes("404") &&
        !msg.includes("NetworkError") &&
        !msg.includes("Unexpected token") &&
        !msg.includes("<!DOCTYPE")
      ) {
        throw apiErr;
      }
    }

    // 2. Fallback: Edge Function / Server function with supabaseAdmin
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke("biometric-auth", {
        body: {
          action: "face-login",
          email,
          descriptor: data.descriptor,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        },
      });
      if (!edgeErr && edgeRes?.session) {
        return edgeRes.session;
      }
      if (edgeRes?.error) {
        throw new Error(edgeRes.error);
      }
    } catch (edgeErr: any) {
      const msg = String(edgeErr?.message || "");
      if (
        msg &&
        !msg.includes("FunctionsFetchError") &&
        !msg.includes("404") &&
        !msg.includes("Unexpected token") &&
        !msg.includes("<!DOCTYPE")
      ) {
        throw edgeErr;
      }
    }

    // 3. Fallback: Call biometric_verify_face RPC (works for anonymous users via SECURITY DEFINER)
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: rawRpcRes, error: rpcErr } = await (supabase.rpc as any)("biometric_verify_face", {
      _email: email,
      _descriptor: data.descriptor,
    });
    const rpcRes = rawRpcRes as { ok?: boolean; error?: string; user_id?: string; email?: string; distance?: number } | null;

    if (rpcErr) {
      throw new Error(rpcErr.message);
    }
    if (!rpcRes?.ok) {
      throw new Error(rpcRes?.error || "Face did not match");
    }

    // Face verified in database! Attempt to mint session if running in SSR context with admin key:
    try {
      const session = await mintSession(email);
      await logBiometricEvent({
        userId: rpcRes.user_id,
        email,
        method: "face",
        event: "login",
        success: true,
        distance: rpcRes.distance,
      });
      return session;
    } catch {
      // In pure static SPA client without Edge Function deployed:
      // Return verification confirmation object
      return { ok: true, matched: true, user_id: rpcRes.user_id, email };
    }
  });

// ── WebAuthn (fingerprint / platform authenticator) ──────
function getOrigin() {
  const req = getRequest();
  const url = new URL(req.url);
  return { origin: url.origin, rpID: url.hostname };
}

export const webauthnRegisterOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ label: z.string().max(80).optional() }).parse(i))
  .handler(async ({ context }) => {
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = getOrigin();
    const { data: profile } = await context.supabase
      .from("profiles").select("email, full_name").eq("id", context.userId).maybeSingle();
    const { data: existing } = await context.supabase
      .from("webauthn_credentials").select("credential_id, transports").eq("user_id", context.userId);
    const options = await generateRegistrationOptions({
      rpName: "INT-HR",
      rpID,
      userID: new TextEncoder().encode(context.userId),
      userName: profile?.email ?? context.userId,
      userDisplayName: profile?.full_name ?? profile?.email ?? "User",
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      excludeCredentials: (existing ?? []).map((c: any) => ({
        id: c.credential_id,
        transports: c.transports ?? undefined,
      })),
    });
    await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: context.userId,
      email: profile?.email ?? null,
      challenge: options.challenge,
      kind: "register",
    });
    return options;
  });

export const webauthnRegisterVerify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ response: z.any(), label: z.string().max(80).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { origin, rpID } = getOrigin();
    const label = data.label || "This device";
    const fail = async (reason: string, credId?: string): Promise<never> => {
      await logBiometricEvent({
        userId: context.userId,
        method: "fingerprint",
        event: "enroll",
        success: false,
        reason,
        deviceLabel: label,
        deviceId: credId ?? data.response?.id ?? null,
      });
      throw new Error(reason);
    };

    const { data: ch } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", context.userId).eq("kind", "register")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ch) return await fail("No registration challenge found");
    if (new Date(ch.expires_at).getTime() < Date.now()) return await fail("Challenge expired");

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: data.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (err: any) {
      return await fail(err?.message ?? "Verification failed");
    }

    if (!verification?.verified || !verification.registrationInfo) {
      return await fail("Verification failed");
    }
    const info: any = verification.registrationInfo;
    const cred = info.credential ?? info; // simplewebauthn v13 nests inside .credential
    const credentialId: string = cred.id;
    const publicKey: string = typeof cred.publicKey === "string"
      ? cred.publicKey
      : Buffer.from(cred.publicKey).toString("base64url");
    const counter: number = cred.counter ?? 0;
    const transports: string[] | null = data.response.response?.transports ?? null;
    const { error: insErr } = await supabaseAdmin.from("webauthn_credentials").insert({
      user_id: context.userId,
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      transports,
      device_label: label,
    });
    if (insErr) {
      return await fail(insErr.message, credentialId);
    }
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", ch.id);

    await logBiometricEvent({
      userId: context.userId,
      method: "fingerprint",
      event: "enroll",
      success: true,
      deviceLabel: label,
      deviceId: credentialId,
    });
    return { ok: true };
  });

// Auth options (anonymous — caller provides email)
export const webauthnAuthOptions = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ email: z.string().email() }).parse(i))
  .handler(async ({ data }) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = getOrigin();
    const email = data.email.toLowerCase().trim();
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id, status").ilike("email", email).maybeSingle();
    if (!profile) throw new Error("No account for this email");
    if ((profile as any)?.status === "Inactive") {
      throw new Error("This account is inactive. Please contact your administrator.");
    }
    const { data: creds } = await supabaseAdmin
      .from("webauthn_credentials").select("credential_id, transports").eq("user_id", profile.id);
    if (!creds?.length) throw new Error("No fingerprint registered for this account");
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: creds.map((c: any) => ({
        id: c.credential_id,
        transports: c.transports ?? undefined,
      })),
    });
    await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: profile.id,
      email,
      challenge: options.challenge,
      kind: "authenticate",
    });
    return options;
  });

export const webauthnAuthVerify = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ email: z.string().email(), response: z.any() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { origin, rpID } = getOrigin();
    const email = data.email.toLowerCase().trim();
    const credId: string = data.response?.id ?? null;

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id, status").ilike("email", email).maybeSingle();

    const fail = async (reason: string, deviceLabel?: string | null): Promise<never> => {
      await logBiometricEvent({
        userId: (profile as any)?.id ?? null,
        email,
        method: "fingerprint",
        event: "login",
        success: false,
        reason,
        deviceId: credId,
        deviceLabel: deviceLabel ?? null,
      });
      throw new Error(reason);
    };

    if (!profile) return await fail("No account for this email");
    if ((profile as any)?.status === "Inactive") {
      return await fail("This account is inactive. Please contact your administrator.");
    }
    const { data: cred } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("id, credential_id, public_key, counter, transports, device_label")
      .eq("user_id", profile.id).eq("credential_id", credId).maybeSingle();
    if (!cred) return await fail("Unknown credential for this account");

    const { data: ch } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", profile.id).eq("kind", "authenticate")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ch) return await fail("No authentication challenge found", cred.device_label);
    if (new Date(ch.expires_at).getTime() < Date.now()) return await fail("Challenge expired", cred.device_label);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: data.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.credential_id,
          publicKey: Buffer.from(cred.public_key, "base64url"),
          counter: Number(cred.counter),
          transports: (cred.transports ?? undefined) as any,
        },
        requireUserVerification: false,
      });
    } catch (err: any) {
      return await fail(err?.message ?? "Fingerprint verification error", cred.device_label);
    }

    if (!verification?.verified) return await fail("Fingerprint verification failed", cred.device_label);

    await supabaseAdmin.from("webauthn_credentials")
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", cred.id);
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", ch.id);

    const session = await mintSession(email);
    await logBiometricEvent({
      userId: profile.id,
      email,
      method: "fingerprint",
      event: "login",
      success: true,
      deviceId: credId,
      deviceLabel: cred.device_label,
    });
    return session;
  });

// Used by check-in flow: verify the *current* user's fingerprint
export const webauthnAuthOptionsForSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = getOrigin();
    const [{ data: creds }, { data: profile }] = await Promise.all([
      context.supabase.from("webauthn_credentials").select("credential_id, transports").eq("user_id", context.userId),
      context.supabase.from("profiles").select("email").eq("id", context.userId).maybeSingle(),
    ]);
    if (!creds?.length) throw new Error("No fingerprint registered");
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: creds.map((c: any) => ({
        id: c.credential_id,
        transports: c.transports ?? undefined,
      })),
    });
    await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: context.userId,
      email: profile?.email ?? null,
      challenge: options.challenge,
      kind: "authenticate",
    });
    return options;
  });

export const webauthnAuthVerifyForSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ response: z.any() }).parse(i))
  .handler(async ({ data, context }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { origin, rpID } = getOrigin();
    const credId: string = data.response?.id ?? null;

    const fail = async (reason: string, deviceLabel?: string | null): Promise<never> => {
      await logBiometricEvent({
        userId: context.userId,
        method: "fingerprint",
        event: "verify",
        success: false,
        reason,
        deviceId: credId,
        deviceLabel: deviceLabel ?? null,
      });
      throw new Error(reason);
    };

    const { data: cred } = await context.supabase
      .from("webauthn_credentials")
      .select("id, credential_id, public_key, counter, transports, device_label")
      .eq("user_id", context.userId).eq("credential_id", credId).maybeSingle();
    if (!cred) return await fail("Unknown credential");

    const { data: ch } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", context.userId).eq("kind", "authenticate")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ch) return await fail("No challenge found", cred.device_label);
    if (new Date(ch.expires_at).getTime() < Date.now()) return await fail("Challenge expired", cred.device_label);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: data.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.credential_id,
          publicKey: Buffer.from(cred.public_key, "base64url"),
          counter: Number(cred.counter),
          transports: (cred.transports ?? undefined) as any,
        },
        requireUserVerification: false,
      });
    } catch (err: any) {
      return await fail(err?.message ?? "Fingerprint verification error", cred.device_label);
    }

    if (!verification?.verified) return await fail("Fingerprint did not verify", cred.device_label);

    await supabaseAdmin.from("webauthn_credentials")
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", cred.id);
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", ch.id);

    await logBiometricEvent({
      userId: context.userId,
      method: "fingerprint",
      event: "verify",
      success: true,
      deviceId: credId,
      deviceLabel: cred.device_label,
    });
    return { ok: true };
  });

// ── Management ───────────────────────────────────────────
export const listMyBiometrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: face }, { data: creds }] = await Promise.all([
      context.supabase.from("face_descriptors").select("enrolled_at, updated_at")
        .eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("webauthn_credentials")
        .select("id, device_label, created_at, last_used_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);
    return {
      face: face ? { enrolled_at: face.enrolled_at, updated_at: face.updated_at } : null,
      fingerprints: (creds ?? []) as Array<{ id: string; device_label: string | null; created_at: string; last_used_at: string | null }>,
    };
  });

export const deleteWebauthnCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("webauthn_credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    await logBiometricEvent({
      userId: context.userId,
      method: "fingerprint",
      event: "unenroll",
      success: !error,
      reason: error?.message ?? null,
      deviceId: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Session minting (admin) ──────────────────────────────
async function mintSession(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("status")
    .ilike("email", email)
    .maybeSingle();
  if ((profile as any)?.status === "Inactive") {
    throw new Error("This account is inactive. Please contact your administrator.");
  }
  // Generate a magic link, extract the OTP, then verify it server-side to get
  // an access_token / refresh_token pair we can hand to the client.
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not generate session");
  const otp = (data.properties as any)?.email_otp as string | undefined;
  if (!otp) throw new Error("OTP missing from generated link");
  const { data: verify, error: vErr } = await supabaseAdmin.auth.verifyOtp({
    type: "magiclink",
    email,
    token: otp,
  });
  if (vErr || !verify.session) throw new Error(vErr?.message ?? "Failed to mint session");
  return {
    access_token: verify.session.access_token,
    refresh_token: verify.session.refresh_token,
  };
}