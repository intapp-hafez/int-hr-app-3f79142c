// Send an email via SMTP from a Supabase Edge Function (Deno runtime).
// Caller must be an authenticated admin/HR user — we verify the JWT and role.
// Body: { auth: { host, port, secure, username, password }, msg: { from, fromEmail, to[], subject, text?, html? } }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { ok: false, error: "Missing auth token" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json(401, { ok: false, error: "Invalid session" });

    const uid = userData.user.id;
    const [isAdmin, isHr] = await Promise.all([
      supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: uid, _role: "hr" }),
    ]);
    if (!isAdmin.data && !isHr.data) {
      return json(403, { ok: false, error: "Forbidden" });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { ok: false, error: "Invalid body" });

    const auth = (body as any).auth;
    const msg = (body as any).msg;
    if (!auth?.host || !auth?.port || !auth?.username || !auth?.password) {
      return json(400, { ok: false, error: "Missing SMTP credentials" });
    }
    if (!msg?.fromEmail || !Array.isArray(msg.to) || msg.to.length === 0 || !msg.subject) {
      return json(400, { ok: false, error: "Invalid message" });
    }

    const client = new SMTPClient({
      connection: {
        hostname: String(auth.host),
        port: Number(auth.port),
        tls: !!auth.secure,
        auth: {
          username: String(auth.username),
          password: String(auth.password),
        },
      },
    });

    try {
      await client.send({
        from: msg.from || msg.fromEmail,
        to: msg.to,
        subject: msg.subject,
        content: msg.text || " ",
        html: msg.html || undefined,
      });
    } finally {
      try { await client.close(); } catch { /* ignore */ }
    }

    return json(200, { ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(500, { ok: false, error: message });
  }
});