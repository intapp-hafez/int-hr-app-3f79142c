// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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

function welcomeEmail(input: { employeeName: string; username: string; password: string; loginUrl: string; appName: string }) {
  const appName = input.appName || "HR Portal";
  const subject = `Welcome to ${appName} - Your account is ready`;
  const textBody =
    `Hello ${input.employeeName},\n\n` +
    `Welcome to ${appName}! Your account has been created.\n\n` +
    `Login URL: ${input.loginUrl}\n` +
    `Username: ${input.username}\n` +
    `Password: ${input.password}\n\n` +
    `For your security, please sign in and change your password as soon as possible.\n\n` +
    `If you did not expect this email, please contact your HR administrator.\n`;
  const html = `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 8px;color:#111">Welcome to ${escapeHtml(appName)}</h2>
    <p style="margin:0 0 16px;color:#444">Hello <b>${escapeHtml(input.employeeName)}</b>, your account has been created. You can now sign in with the credentials below.</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f6f8fb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:8px 0 16px;width:100%">
      <tr><td style="padding:6px 12px;color:#555;width:120px"><b>Login URL</b></td><td style="padding:6px 12px"><a href="${escapeHtml(input.loginUrl)}" style="color:#2563eb">${escapeHtml(input.loginUrl)}</a></td></tr>
      <tr><td style="padding:6px 12px;color:#555"><b>Username</b></td><td style="padding:6px 12px;font-family:Consolas,Menlo,monospace">${escapeHtml(input.username)}</td></tr>
      <tr><td style="padding:6px 12px;color:#555"><b>Password</b></td><td style="padding:6px 12px;font-family:Consolas,Menlo,monospace">${escapeHtml(input.password)}</td></tr>
    </table>
    <p style="margin:0 0 8px"><a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Sign in now</a></p>
    <p style="margin:16px 0 0;color:#666;font-size:12px">For your security, please change your password after your first sign-in. For more information, please contact your HR administrator. Developer Mr.Hafez Rahim</p>
  </div>`;
  return { subject, text: textBody, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  let newUserId = "";
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { ok: false, error: "Missing auth token" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("ADMIN_SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData.user) return json(401, { ok: false, error: "Invalid session" });

    const uid = userData.user.id;
    const [isAdmin, isHr] = await Promise.all([
      caller.rpc("has_role", { _user_id: uid, _role: "admin" }),
      caller.rpc("has_role", { _user_id: uid, _role: "hr" }),
    ]);
    if (!isAdmin.data && !isHr.data) return json(403, { ok: false, error: "Forbidden" });

    const body = await req.json().catch(() => null) as JsonBody | null;
    if (!body || typeof body !== "object") return json(400, { ok: false, error: "Invalid body" });

    const email = text(body.email).toLowerCase();
    const fullName = text(body.name);
    const fullNameAr = text(body.nameAr);
    const password = String(body.password ?? "");
    const role = text(body.role) || "employee";
    const empCode = text(body.empCode);
    const dept = text(body.dept);
    const position = text(body.position);
    const idIssueDate = text(body.idIssueDate);
    const idExpiryDate = text(body.nationalIdExpiry);
    const allowedRoles = new Set(["admin", "hr", "manager", "employee", "staff", "user"]);

    if (!fullName || fullName.length < 2) return json(400, { ok: false, error: "Name is required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { ok: false, error: "Valid email required" });
    if (password.length < 6) return json(400, { ok: false, error: "Password must be at least 6 characters" });
    if (!allowedRoles.has(role)) return json(400, { ok: false, error: `Invalid role: ${role}` });
    if (!validDate(idIssueDate) || !validDate(idExpiryDate)) return json(400, { ok: false, error: "Invalid ID date" });
    if (idIssueDate && idExpiryDate && idIssueDate > idExpiryDate) return json(400, { ok: false, error: "ID issue date cannot be after the expiry date" });

    const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existingProfile) return json(409, { ok: false, error: `Employee email already exists: ${email}` });
    if (empCode) {
      const { data: existingCode } = await admin.from("profiles").select("id").eq("emp_code", empCode).maybeSingle();
      if (existingCode) return json(409, { ok: false, error: `Employee code already exists: ${empCode}` });
    }

    const [{ data: departments }, { data: positions }] = await Promise.all([
      admin.from("departments").select("id, name_en"),
      admin.from("positions").select("id, name_en"),
    ]);
    const departmentId = dept ? ((departments ?? []).find((d: any) => String(d.name_en).toLowerCase() === dept.toLowerCase()) as any)?.id ?? null : null;
    const positionId = position ? ((positions ?? []).find((p: any) => String(p.name_en).toLowerCase() === position.toLowerCase()) as any)?.id ?? null : null;
    if (dept && !departmentId) return json(400, { ok: false, error: `Unknown department: ${dept}` });
    if (position && !positionId) return json(400, { ok: false, error: `Unknown position: ${position}` });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, full_name_ar: fullNameAr || null },
    });
    if (createError) return json(400, { ok: false, error: createError.message, accountCreated: false, profileCreated: false, emailSent: false });
    newUserId = created.user?.id ?? "";
    if (!newUserId) return json(500, { ok: false, error: "Auth user was not created", accountCreated: false, profileCreated: false, emailSent: false });

    const profile = {
      id: newUserId,
      emp_code: empCode || null,
      full_name: fullName,
      full_name_ar: fullNameAr || null,
      email,
      phone: text(body.phone) || null,
      role,
      city: text(body.city) || null,
      district: text(body.district) || null,
      department_id: departmentId,
      section_id: text(body.sectionId) || null,
      position_id: positionId,
      job_grade: text(body.jobGrade) || null,
      cost_center_id: text(body.costCenterId) || null,
      status: text(body.status) === "Inactive" ? "Inactive" : "Active",
      avatar_url: text(body.avatarUrl) || null,
      national_id: text(body.nationalId) || null,
      id_issue_date: idIssueDate || null,
      id_expiry_date: idExpiryDate || null,
      manager_id: text(body.managerId) || null,
      salary_mode: text(body.salaryMode) || "gross",
      salary_gross: num(body.salaryGross) || null,
      salary_net: num(body.salaryNet) || null,
      salary_amount: text(body.salaryMode) === "net" ? num(body.salaryNet) : num(body.salaryGross),
      allowance: num(body.allowance) || null,
      target_value: num(body.targetValue) || null,
      target_duration: text(body.targetDuration) || "Monthly",
      contract_type: text(body.contractType) || "FullTime",
      contract_start_date: text(body.contractStartDate) || null,
      contract_end_date: text(body.contractEndDate) || null,
      contract_cancelled: Boolean(body.contractCancelled),
      extra_email: text(body.extraEmail) || null,
      medical_insurance_details: text(body.medicalInsuranceDetails) || null,
      medical_insurance_number: text(body.medicalInsuranceNumber) || null,
      medical_insurance_type: text(body.medicalInsuranceType) || null,
      insurance_number: text(body.insuranceNumber) || null,
      is_insured: Boolean(body.isInsured),
      military_expire_date: text(body.militaryExpireDate) || null,
      is_five_percent: Boolean(body.isFivePercent),
      social_insurance_date: text(body.socialInsuranceDate) || null,
      custom_field: text(body.customField) || null,
    };

    let { error: profileError } = await admin.from("profiles").upsert(profile as any);
    if (profileError && (
      profileError.message?.includes("cost_center_id") || profileError.details?.includes("cost_center_id") ||
      profileError.message?.includes("medical_insurance_number") || profileError.details?.includes("medical_insurance_number") ||
      profileError.message?.includes("medical_insurance_type") || profileError.details?.includes("medical_insurance_type")
    )) {
      const cleanProfile = { ...profile };
      if (profileError.message?.includes("cost_center_id") || profileError.details?.includes("cost_center_id")) {
        delete (cleanProfile as any).cost_center_id;
      }
      if (profileError.message?.includes("medical_insurance_number") || profileError.details?.includes("medical_insurance_number")) {
        delete (cleanProfile as any).medical_insurance_number;
      }
      if (profileError.message?.includes("medical_insurance_type") || profileError.details?.includes("medical_insurance_type")) {
        delete (cleanProfile as any).medical_insurance_type;
      }
      const res = await admin.from("profiles").upsert(cleanProfile as any);
      profileError = res.error;
    }
    if (profileError) throw new Error(profileError.message);
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: newUserId, role } as any, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleError) throw new Error(roleError.message);

    const decryptKey = Deno.env.get("SMTP_ENCRYPTION_KEY") || "dev-fallback-key-change-me";
    const { data: smtpRows, error: smtpError } = await admin.rpc("smtp_config_decrypt", { _key: decryptKey });
    const smtp = Array.isArray(smtpRows) ? smtpRows[0] : smtpRows;
    if (smtpError || !smtp?.host || !smtp?.password) {
      return json(200, {
        ok: false,
        id: newUserId,
        email,
        accountCreated: true,
        profileCreated: true,
        emailSent: false,
        warning: smtpError?.message || "SMTP not configured",
      });
    }

    const appName = text(body.appName) || "HR Portal";
    const loginUrl = text(body.loginUrl);
    const rendered = welcomeEmail({ employeeName: fullName, username: email, password, loginUrl, appName });
    try {
      await sendSmtpDirect(
        {
          host: String(smtp.host),
          port: Number(smtp.port),
          secure: Boolean(smtp.secure),
          username: String(smtp.username),
          password: String(smtp.password),
        },
        {
          from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
          fromEmail: smtp.from_email,
          to: [email],
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        }
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return json(200, {
        ok: false,
        id: newUserId,
        email,
        accountCreated: true,
        profileCreated: true,
        emailSent: false,
        warning: message || "Welcome email failed",
      });
    } finally {
      // SMTP send errors are returned as warnings above; account creation remains committed.
    }

    return json(200, { ok: true, id: newUserId, email, accountCreated: true, profileCreated: true, emailSent: true });
  } catch (e) {
    if (newUserId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("ADMIN_SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      await admin.from("user_roles").delete().eq("user_id", newUserId);
      await admin.from("profiles").delete().eq("id", newUserId);
      await admin.auth.admin.deleteUser(newUserId);
    }
    const message = e instanceof Error ? e.message : String(e);
    return json(500, { ok: false, error: message, accountCreated: false, profileCreated: false, emailSent: false });
  }
});