/**
 * Minimal SMTP client built on Cloudflare Workers TCP sockets.
 * Supports implicit TLS (port 465), STARTTLS (port 587/25), and AUTH LOGIN.
 * Returns a structured result so callers can persist deliveries.
 *
 * NOT a full-featured client; intentionally compact for transactional sends.
 */
// cloudflare:sockets is a Workers runtime built-in without local types.
// Imported dynamically so Vite's dep scanner doesn't try to resolve it in dev.
type CfConnect = (
  address: { hostname: string; port: number },
  options?: { secureTransport?: "on" | "off" | "starttls"; allowHalfOpen?: boolean },
) => any;
async function loadConnect(): Promise<CfConnect> {
  // @ts-expect-error - Workers runtime built-in
  const mod = await import(/* @vite-ignore */ "cloudflare:sockets");
  return mod.connect as CfConnect;
}

export type SmtpAuth = {
  host: string;
  port: number;
  secure: boolean; // true = implicit TLS (465); false = STARTTLS upgrade
  username: string;
  password: string;
};

export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
  contentType: string;
};

export type SmtpMessage = {
  from: string; // "Name <addr@x>" or "addr@x"
  fromEmail: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export type SmtpResult = {
  ok: boolean;
  code?: number;
  message?: string;
  log?: string[];
};

const CRLF = "\r\n";

function encodeBase64(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  // btoa is available in Workers runtime
  return btoa(s);
}

function chunkBase64(b64: string, size = 76): string {
  const parts: string[] = [];
  for (let i = 0; i < b64.length; i += size) parts.push(b64.slice(i, i + size));
  return parts.join(CRLF);
}

function buildMime(msg: SmtpMessage): string {
  const boundary = "----hr-app-" + Math.random().toString(36).slice(2);
  const lines: string[] = [];
  lines.push(`From: ${msg.from}`);
  lines.push(`To: ${msg.to.join(", ")}`);
  lines.push(`Subject: ${msg.subject}`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Date: ${new Date().toUTCString()}`);

  const hasAttach = msg.attachments && msg.attachments.length > 0;
  if (!hasAttach) {
    if (msg.html) {
      lines.push(`Content-Type: text/html; charset=utf-8`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push("");
      lines.push(chunkBase64(encodeBase64(msg.html)));
    } else {
      lines.push(`Content-Type: text/plain; charset=utf-8`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push("");
      lines.push(chunkBase64(encodeBase64(msg.text || "")));
    }
  } else {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    if (msg.html) {
      lines.push(`Content-Type: text/html; charset=utf-8`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push("");
      lines.push(chunkBase64(encodeBase64(msg.html)));
    } else {
      lines.push(`Content-Type: text/plain; charset=utf-8`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push("");
      lines.push(chunkBase64(encodeBase64(msg.text || "")));
    }
    for (const att of msg.attachments!) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push("");
      lines.push(chunkBase64(encodeBase64(att.content)));
    }
    lines.push(`--${boundary}--`);
  }
  // dot-stuffing: any line beginning with "." gets an extra "."
  return lines
    .join(CRLF)
    .split(CRLF)
    .map((l) => (l.startsWith(".") ? "." + l : l))
    .join(CRLF);
}

/**
 * Open an SMTP socket, optionally upgrade with STARTTLS, run an async fn,
 * then QUIT.
 */
export async function sendEmail(auth: SmtpAuth, msg: SmtpMessage): Promise<SmtpResult> {
  const log: string[] = [];
  let socket: any = null;
  try {
    const connect = await loadConnect();
    socket = connect(
      { hostname: auth.host, port: auth.port },
      auth.secure ? { secureTransport: "on" } : { secureTransport: "starttls" },
    );

    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    const dec = new TextDecoder();
    const enc = new TextEncoder();

    let buffer = "";
    async function readReply(): Promise<{ code: number; lines: string[] }> {
      // SMTP multi-line: lines look like "250-..." then final "250 ...".
      // Read until we have a complete reply.
      // Drain socket until terminator.
      // Defensive cap.
      for (let attempt = 0; attempt < 50; attempt++) {
        // Check if buffer already contains complete reply
        const lines = buffer.split(CRLF);
        // Find final line index (matches /^\d{3} /)
        let finalIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (/^\d{3} /.test(lines[i])) { finalIdx = i; break; }
        }
        if (finalIdx >= 0) {
          const replyLines = lines.slice(0, finalIdx + 1);
          const rest = lines.slice(finalIdx + 1).join(CRLF);
          buffer = rest;
          const code = parseInt(replyLines[finalIdx].slice(0, 3), 10);
          log.push(`S: ${replyLines.join(" / ")}`);
          return { code, lines: replyLines };
        }
        const { value, done } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
      }
      throw new Error("SMTP read timeout");
    }

    async function write(cmd: string, redact = false) {
      log.push(`C: ${redact ? "<redacted>" : cmd.trim()}`);
      await writer.write(enc.encode(cmd));
    }

    // Greeting
    let r = await readReply();
    if (r.code !== 220) throw new Error(`Greeting failed: ${r.code}`);

    // EHLO
    await write(`EHLO hr-app.local${CRLF}`);
    r = await readReply();
    if (r.code !== 250) throw new Error(`EHLO failed: ${r.code}`);

    // STARTTLS branch — the cloudflare:sockets startTls() returns a new socket.
    if (!auth.secure && r.lines.some((l) => l.toUpperCase().includes("STARTTLS"))) {
      await write(`STARTTLS${CRLF}`);
      const tlsR = await readReply();
      if (tlsR.code !== 220) throw new Error(`STARTTLS failed: ${tlsR.code}`);
      // Release current locks before upgrade.
      writer.releaseLock();
      reader.releaseLock();
      const upgraded = socket.startTls();
      // Replace socket reference for cleanup at end.
      socket = upgraded;
      const w2 = upgraded.writable.getWriter();
      const r2 = upgraded.readable.getReader();
      buffer = "";
      // re-EHLO over TLS
      const enc2 = new TextEncoder();
      const dec2 = new TextDecoder();
      async function tlsRead(): Promise<{ code: number; lines: string[] }> {
        for (let attempt = 0; attempt < 50; attempt++) {
          const lines = buffer.split(CRLF);
          let finalIdx = -1;
          for (let i = 0; i < lines.length; i++) if (/^\d{3} /.test(lines[i])) { finalIdx = i; break; }
          if (finalIdx >= 0) {
            const replyLines = lines.slice(0, finalIdx + 1);
            buffer = lines.slice(finalIdx + 1).join(CRLF);
            log.push(`S: ${replyLines.join(" / ")}`);
            return { code: parseInt(replyLines[finalIdx].slice(0, 3), 10), lines: replyLines };
          }
          const { value, done } = await r2.read();
          if (done) break;
          buffer += dec2.decode(value, { stream: true });
        }
        throw new Error("SMTP read timeout (tls)");
      }
      async function tlsWrite(cmd: string, redact = false) {
        log.push(`C: ${redact ? "<redacted>" : cmd.trim()}`);
        await w2.write(enc2.encode(cmd));
      }
      await tlsWrite(`EHLO hr-app.local${CRLF}`);
      const ehlo2 = await tlsRead();
      if (ehlo2.code !== 250) throw new Error(`EHLO (tls) failed: ${ehlo2.code}`);
      // AUTH LOGIN
      await tlsWrite(`AUTH LOGIN${CRLF}`);
      let a = await tlsRead();
      if (a.code !== 334) throw new Error(`AUTH LOGIN start failed: ${a.code}`);
      await tlsWrite(`${encodeBase64(auth.username)}${CRLF}`, true);
      a = await tlsRead();
      if (a.code !== 334) throw new Error(`AUTH username failed: ${a.code}`);
      await tlsWrite(`${encodeBase64(auth.password)}${CRLF}`, true);
      a = await tlsRead();
      if (a.code !== 235) throw new Error(`AUTH password failed: ${a.code}`);
      // MAIL FROM
      await tlsWrite(`MAIL FROM:<${msg.fromEmail}>${CRLF}`);
      let m = await tlsRead();
      if (m.code !== 250) throw new Error(`MAIL FROM failed: ${m.code}`);
      for (const rcpt of msg.to) {
        await tlsWrite(`RCPT TO:<${rcpt}>${CRLF}`);
        m = await tlsRead();
        if (m.code !== 250 && m.code !== 251) throw new Error(`RCPT failed (${rcpt}): ${m.code}`);
      }
      await tlsWrite(`DATA${CRLF}`);
      m = await tlsRead();
      if (m.code !== 354) throw new Error(`DATA failed: ${m.code}`);
      const body = buildMime(msg) + CRLF + "." + CRLF;
      await tlsWrite(body);
      m = await tlsRead();
      if (m.code !== 250) throw new Error(`Message rejected: ${m.code}`);
      await tlsWrite(`QUIT${CRLF}`);
      try { await tlsRead(); } catch { /* ignore */ }
      try { await upgraded.close(); } catch { /* ignore */ }
      return { ok: true, code: 250, message: "OK", log };
    }

    // Non-STARTTLS path (implicit TLS or plain) — reuse original socket
    await write(`AUTH LOGIN${CRLF}`);
    let a = await readReply();
    if (a.code !== 334) throw new Error(`AUTH LOGIN start failed: ${a.code}`);
    await write(`${encodeBase64(auth.username)}${CRLF}`, true);
    a = await readReply();
    if (a.code !== 334) throw new Error(`AUTH username failed: ${a.code}`);
    await write(`${encodeBase64(auth.password)}${CRLF}`, true);
    a = await readReply();
    if (a.code !== 235) throw new Error(`AUTH password failed: ${a.code}`);

    await write(`MAIL FROM:<${msg.fromEmail}>${CRLF}`);
    let m = await readReply();
    if (m.code !== 250) throw new Error(`MAIL FROM failed: ${m.code}`);
    for (const rcpt of msg.to) {
      await write(`RCPT TO:<${rcpt}>${CRLF}`);
      m = await readReply();
      if (m.code !== 250 && m.code !== 251) throw new Error(`RCPT failed (${rcpt}): ${m.code}`);
    }
    await write(`DATA${CRLF}`);
    m = await readReply();
    if (m.code !== 354) throw new Error(`DATA failed: ${m.code}`);
    const body = buildMime(msg) + CRLF + "." + CRLF;
    await write(body);
    m = await readReply();
    if (m.code !== 250) throw new Error(`Message rejected: ${m.code}`);
    await write(`QUIT${CRLF}`);
    try { await readReply(); } catch { /* ignore */ }
    try { await socket.close(); } catch { /* ignore */ }
    return { ok: true, code: 250, message: "OK", log };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try { await socket?.close(); } catch { /* ignore */ }
    return { ok: false, message, log };
  }
}