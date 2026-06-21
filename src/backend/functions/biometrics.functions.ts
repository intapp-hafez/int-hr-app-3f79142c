import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    if (!row) return { match: false, enrolled: false, distance: null as number | null };
    const stored = row.descriptor as unknown as number[];
    const d = distance(stored, data.descriptor);
    return { match: d <= FACE_THRESHOLD, enrolled: true, distance: d };
  });

// Used during login: scope the lookup by an email the user types
export const getFaceDescriptorForLogin = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ email: z.string().email() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase().trim())
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase().trim();
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) throw new Error("No account for this email");
    const { data: row } = await supabaseAdmin
      .from("face_descriptors").select("descriptor").eq("user_id", profile.id).maybeSingle();
    if (!row) throw new Error("Face not enrolled for this account");
    const d = distance(row.descriptor as unknown as number[], data.descriptor);
    if (d > FACE_THRESHOLD) throw new Error(`Face did not match (distance ${d.toFixed(3)})`);
    return await mintSession(email);
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
    const { data: ch } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", context.userId).eq("kind", "register")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ch) throw new Error("No registration challenge found");
    if (new Date(ch.expires_at).getTime() < Date.now()) throw new Error("Challenge expired");
    const verification = await verifyRegistrationResponse({
      response: data.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Verification failed");
    }
    const info: any = verification.registrationInfo;
    const cred = info.credential ?? info; // simplewebauthn v13 nests inside .credential
    const credentialId: string = cred.id;
    const publicKey: string = typeof cred.publicKey === "string"
      ? cred.publicKey
      : Buffer.from(cred.publicKey).toString("base64url");
    const counter: number = cred.counter ?? 0;
    const transports: string[] | null = data.response.response?.transports ?? null;
    await supabaseAdmin.from("webauthn_credentials").insert({
      user_id: context.userId,
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      transports,
      device_label: data.label || "This device",
    });
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", ch.id);
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
      .from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) throw new Error("No account for this email");
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
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) throw new Error("No account for this email");
    const credId: string = data.response.id;
    const { data: cred } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("id, credential_id, public_key, counter, transports")
      .eq("user_id", profile.id).eq("credential_id", credId).maybeSingle();
    if (!cred) throw new Error("Unknown credential");
    const { data: ch } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", profile.id).eq("kind", "authenticate")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ch) throw new Error("No authentication challenge found");
    if (new Date(ch.expires_at).getTime() < Date.now()) throw new Error("Challenge expired");
    const verification = await verifyAuthenticationResponse({
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
    if (!verification.verified) throw new Error("Fingerprint verification failed");
    await supabaseAdmin.from("webauthn_credentials")
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", cred.id);
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", ch.id);
    return await mintSession(email);
  });

// Used by check-in flow: verify the *current* user's fingerprint
export const webauthnAuthOptionsForSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = getOrigin();
    const { data: creds } = await context.supabase
      .from("webauthn_credentials").select("credential_id, transports").eq("user_id", context.userId);
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
    const credId: string = data.response.id;
    const { data: cred } = await context.supabase
      .from("webauthn_credentials")
      .select("id, credential_id, public_key, counter, transports")
      .eq("user_id", context.userId).eq("credential_id", credId).maybeSingle();
    if (!cred) throw new Error("Unknown credential");
    const { data: ch } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", context.userId).eq("kind", "authenticate")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ch) throw new Error("No challenge");
    if (new Date(ch.expires_at).getTime() < Date.now()) throw new Error("Challenge expired");
    const verification = await verifyAuthenticationResponse({
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
    if (!verification.verified) throw new Error("Fingerprint did not verify");
    await supabaseAdmin.from("webauthn_credentials")
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", cred.id);
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", ch.id);
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
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Session minting (admin) ──────────────────────────────
async function mintSession(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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