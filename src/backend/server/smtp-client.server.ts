/**
 * Minimal SMTP client built on Node.js net/tls sockets.
 * Supports implicit TLS (port 465), STARTTLS (port 587/25), and AUTH LOGIN.
 * Returns a structured result so callers can persist deliveries.
 *
 * NOT a full-featured client; intentionally compact for transactional sends.
 */
import net from "node:net";
import tls from "node:tls";

type AnySocket = net.Socket | tls.TLSSocket;

function connectPlain(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port });
    const onErr = (e: Error) => { s.removeListener("connect", onOk); reject(e); };
    const onOk = () => { s.removeListener("error", onErr); resolve(s); };
    s.once("error", onErr);
    s.once("connect", onOk);
  });
}

function connectTls(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host, port, servername: host });
    const onErr = (e: Error) => { s.removeListener("secureConnect", onOk); reject(e); };
    const onOk = () => { s.removeListener("error", onErr); resolve(s); };
    s.once("error", onErr);
    s.once("secureConnect", onOk);
  });
}

function upgradeToTls(sock: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const t = tls.connect({ socket: sock, servername: host });
    const onErr = (e: Error) => { t.removeListener("secureConnect", onOk); reject(e); };
    const onOk = () => { t.removeListener("error", onErr); resolve(t); };
    t.once("error", onErr);
    t.once("secureConnect", onOk);
  });
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
  let socket: AnySocket | null = null;
  try {
    socket = auth.secure
      ? await connectTls(auth.host, auth.port)
      : await connectPlain(auth.host, auth.port);

    let buffer = "";
    let pending: ((chunk: string) => void) | null = null;
    let closed = false;
    let errored: Error | null = null;

    const attach = (s: AnySocket) => {
      s.setEncoding("utf8");
      s.on("data", (chunk: string) => {
        buffer += chunk;
        if (pending) { const fn = pending; pending = null; fn(""); }
      });
      s.on("error", (e: Error) => {
        errored = e;
        if (pending) { const fn = pending; pending = null; fn(""); }
      });
      s.on("close", () => {
        closed = true;
        if (pending) { const fn = pending; pending = null; fn(""); }
      });
    };
    attach(socket);

    function waitData(): Promise<void> {
      return new Promise((resolve) => { pending = () => resolve(); });
    }

    async function readReply(): Promise<{ code: number; lines: string[] }> {
      for (let attempt = 0; attempt < 200; attempt++) {
        const lines = buffer.split(CRLF);
        let finalIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (/^\d{3} /.test(lines[i])) { finalIdx = i; break; }
        }
        if (finalIdx >= 0) {
          const replyLines = lines.slice(0, finalIdx + 1);
          buffer = lines.slice(finalIdx + 1).join(CRLF);
          const code = parseInt(replyLines[finalIdx].slice(0, 3), 10);
          log.push(`S: ${replyLines.join(" / ")}`);
          return { code, lines: replyLines };
        }
        if (errored) throw errored;
        if (closed) throw new Error("SMTP connection closed");
        await waitData();
      }
      throw new Error("SMTP read timeout");
    }

    function write(cmd: string, redact = false): Promise<void> {
      log.push(`C: ${redact ? "<redacted>" : cmd.trim()}`);
      return new Promise((resolve, reject) => {
        socket!.write(cmd, (err) => (err ? reject(err) : resolve()));
      });
    }

    // Greeting
    let r = await readReply();
    if (r.code !== 220) throw new Error(`Greeting failed: ${r.code}`);

    // EHLO
    await write(`EHLO hr-app.local${CRLF}`);
    r = await readReply();
    if (r.code !== 250) throw new Error(`EHLO failed: ${r.code}`);

    // STARTTLS branch
    if (!auth.secure && r.lines.some((l) => l.toUpperCase().includes("STARTTLS"))) {
      await write(`STARTTLS${CRLF}`);
      const tlsR = await readReply();
      if (tlsR.code !== 220) throw new Error(`STARTTLS failed: ${tlsR.code}`);
      // Upgrade socket to TLS in place
      const plain = socket as net.Socket;
      plain.removeAllListeners("data");
      plain.removeAllListeners("error");
      plain.removeAllListeners("close");
      const upgraded = await upgradeToTls(plain, auth.host);
      socket = upgraded;
      buffer = "";
      closed = false;
      errored = null;
      pending = null;
      attach(upgraded);
      // re-EHLO
      await write(`EHLO hr-app.local${CRLF}`);
      const ehlo2 = await readReply();
      if (ehlo2.code !== 250) throw new Error(`EHLO (tls) failed: ${ehlo2.code}`);
    }

    // AUTH + send (works for implicit TLS, plain, or upgraded STARTTLS)
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
    try { socket.end(); } catch { /* ignore */ }
    return { ok: true, code: 250, message: "OK", log };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try { socket?.destroy(); } catch { /* ignore */ }
    return { ok: false, message, log };
  }
}