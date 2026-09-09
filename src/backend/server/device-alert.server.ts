// Emails the employee's manager plus all admins/HR when a new device
// registration request is submitted, so pending devices are never missed.
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function notifyDeviceRegistration(input: {
  employeeId: string;
  deviceId: string;
  label: string;
  os?: string | null;
  browser?: string | null;
  deviceType?: string | null;
  ip?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: employee } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, manager_id")
      .eq("id", input.employeeId)
      .maybeSingle();

    const recipients = new Set<string>();
    if ((employee as any)?.manager_id) {
      const { data: mgr } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", (employee as any).manager_id)
        .maybeSingle();
      if (mgr?.email) recipients.add(mgr.email);
    }
    const { data: staff } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "hr"]);
    const ids = ((staff ?? []) as any[]).map((r) => r.user_id);
    if (ids.length) {
      const { data: rows } = await supabaseAdmin.from("profiles").select("email").in("id", ids);
      for (const r of (rows ?? []) as any[]) if (r.email) recipients.add(r.email);
    }
    if (recipients.size === 0) return { ok: false, reason: "no-recipients" };

    const who = (employee as any)?.full_name ?? (employee as any)?.email ?? input.employeeId;
    const subject = `New device registration request · ${who}`;
    const lines = [
      ["Employee", who],
      ["Device", input.label],
      ["Device ID", input.deviceId],
      ["Type", input.deviceType ?? "—"],
      ["OS", input.os ?? "—"],
      ["Browser", input.browser ?? "—"],
      ["IP", input.ip ?? "—"],
    ];
    const text = `${subject}\n\n${lines.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nReview it in Admin → Devices.`;
    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:20px;color:#111">
      <h2 style="margin:0 0 12px">${esc(subject)}</h2>
      <p style="margin:0 0 8px">A device is waiting for approval.</p>
      <table style="border-collapse:collapse">
        ${lines.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${esc(k)}</td><td style="padding:4px 0"><strong>${esc(String(v))}</strong></td></tr>`).join("")}
      </table>
      <p style="margin:12px 0 0">Review it in <strong>Admin → Devices</strong>.</p>
    </div>`;

    const smtp = await loadSmtpConfig();
    if (!smtp || !smtp.host || !smtp.password) return { ok: false, reason: "smtp-not-configured" };
    const res = await sendEmail(
      { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
      {
        from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
        fromEmail: smtp.from_email,
        to: Array.from(recipients),
        subject,
        html,
        text,
      },
    );
    return { ok: res.ok };
  } catch {
    // Notification must never break device registration.
    return { ok: false, reason: "error" };
  }
}
