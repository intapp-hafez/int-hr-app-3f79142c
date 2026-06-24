/**
 * Sends the employee welcome email via the configured SMTP transport.
 * Best-effort: returns ok=false on any error instead of throwing, so it
 * never breaks employee creation flows.
 */
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";
import { renderWelcomeEmail } from "./email-render.server";

export async function sendWelcomeEmail(opts: {
  to: string;
  employeeName: string;
  username: string;
  password: string;
  loginUrl: string;
  appName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!opts.to || !opts.password) return { ok: false, error: "missing recipient or password" };
    const smtp = await loadSmtpConfig();
    if (!smtp || !smtp.host || !smtp.password) {
      return { ok: false, error: "SMTP not configured" };
    }
    const { subject, html, text } = renderWelcomeEmail({
      employeeName: opts.employeeName,
      username: opts.username,
      password: opts.password,
      loginUrl: opts.loginUrl,
      appName: opts.appName,
    });
    const res = await sendEmail(
      { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
      {
        from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
        fromEmail: smtp.from_email,
        to: [opts.to],
        subject,
        text,
        html,
      },
    );
    return { ok: res.ok, error: res.ok ? undefined : res.message };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "send failed" };
  }
}