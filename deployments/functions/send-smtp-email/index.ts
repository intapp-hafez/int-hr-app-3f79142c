// @ts-nocheck
// Send an email via SMTP from a Supabase Edge Function (Deno runtime).
// Caller must be an authenticated admin/HR user — we verify the JWT and role.
// Body: { auth: { host, port, secure, username, password }, msg: { from, fromEmail, to[], subject, text?, html? } }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CRLF = "\r\n";

function encodeBase64(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function chunkBase64(b64: string, size = 76): string {
  const parts: string[] = [];
  for (let i = 0; i < b64.length; i += size) parts.push(b64.slice(i, i + size));
  return parts.join(CRLF);
}

function buildMime(msg: { from: string; to: string[]; subject: string; text?: string; html?: string }): string {
  const boundary = "----=_Part_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
  const lines: string[] = [];
  lines.push(`From: ${msg.from}`);
  lines.push(`To: ${msg.to.join(", ")}`);
  lines.push(`Subject: =?UTF-8?B?${encodeBase64(msg.subject)}?=`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Date: ${new Date().toUTCString()}`);

  if (msg.html && msg.text) {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/plain; charset=UTF-8`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push("");
    lines.push(chunkBase64(encodeBase64(msg.text)));
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/html; charset=UTF-8`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push("");
    lines.push(chunkBase64(encodeBase64(msg.html)));
    lines.push("");
    lines.push(`--${boundary}--`);
  } else if (msg.html) {
    lines.push(`Content-Type: text/html; charset=UTF-8`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push("");
    lines.push(chunkBase64(encodeBase64(msg.html)));
  } else {
    lines.push(`Content-Type: text/plain; charset=UTF-8`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push("");
    lines.push(chunkBase64(encodeBase64(msg.text || " ")));
  }

  return lines.join(CRLF);
}

async function sendSmtpDirect(
  auth: { host: string; port: number; secure: boolean; username: string; password: string },
  msg: { from: string; fromEmail: string; to: string[]; subject: string; text?: string; html?: string }
) {
  let conn: Deno.Conn = auth.secure
    ? await Deno.connectTls({ hostname: auth.host, port: Number(auth.port) })
    : await Deno.connect({ hostname: auth.host, port: Number(auth.port) });

  let reader = conn.readable.getReader();
  let writer = conn.writable.getWriter();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buffer = "";

  async function readReply(): Promise<{ code: number; lines: string[] }> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const lines = buffer.split(CRLF);
      let finalIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\d{3} /.test(lines[i])) { finalIdx = i; break; }
      }
      if (finalIdx >= 0) {
        const replyLines = lines.slice(0, finalIdx + 1);
        buffer = lines.slice(finalIdx + 1).join(CRLF);
        const code = parseInt(replyLines[finalIdx].slice(0, 3), 10);
        return { code, lines: replyLines };
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
    }
    throw new Error("SMTP read timeout");
  }

  async function write(cmd: string) {
    await writer.write(enc.encode(cmd));
  }

  try {
    let r = await readReply();
    if (r.code !== 220) throw new Error(`SMTP greeting failed (${r.code}): ${r.lines.join(" ")}`);

    await write(`EHLO localhost${CRLF}`);
    r = await readReply();
    if (r.code !== 250) throw new Error(`EHLO failed (${r.code}): ${r.lines.join(" ")}`);

    if (!auth.secure && r.lines.some((l) => l.toUpperCase().includes("STARTTLS"))) {
      await write(`STARTTLS${CRLF}`);
      const tlsR = await readReply();
      if (tlsR.code !== 220) throw new Error(`STARTTLS failed (${tlsR.code})`);
      writer.releaseLock();
      reader.releaseLock();
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: auth.host });
      reader = conn.readable.getReader();
      writer = conn.writable.getWriter();
      buffer = "";
      await write(`EHLO localhost${CRLF}`);
      r = await readReply();
      if (r.code !== 250) throw new Error(`EHLO after TLS failed (${r.code})`);
    }

    await write(`AUTH LOGIN${CRLF}`);
    r = await readReply();
    if (r.code !== 334) throw new Error(`AUTH LOGIN failed (${r.code}): ${r.lines.join(" ")}`);

    await write(`${encodeBase64(auth.username)}${CRLF}`);
    r = await readReply();
    if (r.code !== 334) throw new Error(`AUTH username failed (${r.code}): ${r.lines.join(" ")}`);

    await write(`${encodeBase64(auth.password)}${CRLF}`);
    r = await readReply();
    if (r.code !== 235) throw new Error(`AUTH password failed (${r.code}): ${r.lines.join(" ")}`);

    await write(`MAIL FROM:<${msg.fromEmail}>${CRLF}`);
    r = await readReply();
    if (r.code !== 250) throw new Error(`MAIL FROM failed (${r.code}): ${r.lines.join(" ")}`);

    for (const rcpt of msg.to) {
      await write(`RCPT TO:<${rcpt}>${CRLF}`);
      r = await readReply();
      if (r.code !== 250 && r.code !== 251) throw new Error(`RCPT TO failed for ${rcpt} (${r.code}): ${r.lines.join(" ")}`);
    }

    await write(`DATA${CRLF}`);
    r = await readReply();
    if (r.code !== 354) throw new Error(`DATA failed (${r.code}): ${r.lines.join(" ")}`);

    const mime = buildMime({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    const dotStuffed = mime
      .split(CRLF)
      .map((line) => (line.startsWith(".") ? "." + line : line))
      .join(CRLF);

    await write(dotStuffed + CRLF + "." + CRLF);
    r = await readReply();
    if (r.code !== 250) throw new Error(`Message rejected (${r.code}): ${r.lines.join(" ")}`);

    await write(`QUIT${CRLF}`);
    try { await readReply(); } catch {}
  } finally {
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { conn.close(); } catch {}
  }
}

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

    await sendSmtpDirect(
      {
        host: String(auth.host),
        port: Number(auth.port),
        secure: Boolean(auth.secure),
        username: String(auth.username),
        password: String(auth.password),
      },
      {
        from: msg.from || msg.fromEmail,
        fromEmail: msg.fromEmail,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }
    );

    return json(200, { ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(500, { ok: false, error: message });
  }
});