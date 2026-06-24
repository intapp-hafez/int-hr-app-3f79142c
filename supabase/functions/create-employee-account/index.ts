import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonBody = Record<string, unknown>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function text(v: unknown) {
  return String(v ?? "").trim();
}

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function validDate(v: string) {
  if (!v) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [year, month, day] = v.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function welcomeEmail(input: { employeeName: string; username: string; password: string; loginUrl: string; appName: string }) {
  const subject = `Welcome to ${input.appName}`;
  const textBody = `Hello ${input.employeeName},\n\nYour account is ready.\n\nLogin: ${input.loginUrl}\nUsername: ${input.username}\nPassword: ${input.password}\n\nPlease sign in and change your password if required.`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
    <h2 style="margin:0 0 12px">Welcome to ${input.appName}</h2>
    <p>Hello ${input.employeeName},</p>
    <p>Your account is ready.</p>
    <p><a href="${input.loginUrl}">Open HR Portal</a></p>
    <p><strong>Username:</strong> ${input.username}<br/><strong>Password:</strong> ${input.password}</p>
    <p>Please sign in and change your password if required.</p>
  </body></html>`;
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
      user_metadata: { full_name: fullName },
    });
    if (createError) return json(400, { ok: false, error: createError.message, accountCreated: false, profileCreated: false, emailSent: false });
    newUserId = created.user?.id ?? "";
    if (!newUserId) return json(500, { ok: false, error: "Auth user was not created", accountCreated: false, profileCreated: false, emailSent: false });

    const profile = {
      id: newUserId,
      emp_code: empCode || null,
      full_name: fullName,
      email,
      phone: text(body.phone) || null,
      role,
      city: text(body.city) || null,
      district: text(body.district) || null,
      department_id: departmentId,
      position_id: positionId,
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
    };

    const { error: profileError } = await admin.from("profiles").upsert(profile as any);
    if (profileError) throw new Error(profileError.message);
    const { error: roleError } = await admin.from("user_roles").upsert({ user_id: newUserId, role } as any);
    if (roleError) throw new Error(roleError.message);

    const decryptKey = Deno.env.get("SMTP_ENCRYPTION_KEY") || "dev-fallback-key-change-me";
    const { data: smtpRows, error: smtpError } = await caller.rpc("smtp_config_decrypt", { _key: decryptKey });
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
    const client = new SMTPClient({
      connection: {
        hostname: String(smtp.host),
        port: Number(smtp.port),
        tls: Boolean(smtp.secure),
        auth: { username: String(smtp.username), password: String(smtp.password) },
      },
    });
    try {
      await client.send({
        from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
        to: email,
        subject: rendered.subject,
        content: rendered.text,
        html: rendered.html,
      });
    } finally {
      try { await client.close(); } catch { /* ignore */ }
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