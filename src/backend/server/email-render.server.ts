function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function renderExportEmail(opts: {
  scheduleName: string;
  runDate: string;
  rangeLabel: string;
  rowCount: number;
}): { subject: string; html: string; text: string } {
  const subject = `[HR] ${opts.scheduleName} - ${opts.runDate}`;
  const text = `Automated export "${opts.scheduleName}"\nDate: ${opts.runDate}\nRange: ${opts.rangeLabel}\nRecords: ${opts.rowCount}\n\nThe file is attached.`;
  const html = `<div style="font-family:system-ui,sans-serif">
    <h2 style="margin:0 0 12px">${escapeHtml(opts.scheduleName)}</h2>
    <p style="margin:0 0 4px"><b>Date:</b> ${escapeHtml(opts.runDate)}</p>
    <p style="margin:0 0 4px"><b>Range:</b> ${escapeHtml(opts.rangeLabel)}</p>
    <p style="margin:0 0 12px"><b>Records:</b> ${opts.rowCount}</p>
    <p style="color:#666">The full activity log is attached.</p>
  </div>`;
  return { subject, html, text };
}

export function renderTaskNotifEmail(opts: {
  employeeName: string;
  kind: string;
  taskName: string;
  city?: string | null;
  district?: string | null;
  note?: string | null;
  occurredAt: string;
}): { subject: string; html: string; text: string } {
  const subject = `[Task] ${opts.employeeName} - ${opts.kind} - ${opts.taskName}`;
  const loc = [opts.city, opts.district].filter(Boolean).join(" / ") || "-";
  const note = opts.note || "-";
  const text = `${opts.employeeName} ${opts.kind} "${opts.taskName}"\nAt: ${opts.occurredAt}\nLocation: ${loc}\nNote: ${note}`;
  const html = `<div style="font-family:system-ui,sans-serif">
    <h3 style="margin:0 0 8px">${escapeHtml(opts.employeeName)} - ${escapeHtml(opts.kind)}</h3>
    <p style="margin:0 0 4px"><b>Task:</b> ${escapeHtml(opts.taskName)}</p>
    <p style="margin:0 0 4px"><b>Time:</b> ${escapeHtml(opts.occurredAt)}</p>
    <p style="margin:0 0 4px"><b>Location:</b> ${escapeHtml(loc)}</p>
    <p style="margin:0 0 4px"><b>Note:</b> ${escapeHtml(note)}</p>
  </div>`;
  return { subject, html, text };
}

export function renderWelcomeEmail(opts: {
  employeeName: string;
  username: string;
  password: string;
  loginUrl: string;
  appName?: string;
}): { subject: string; html: string; text: string } {
  const appName = opts.appName || "HR Portal";
  const subject = `Welcome to ${appName} - Your account is ready`;
  const text =
    `Hello ${opts.employeeName},\n\n` +
    `Welcome to ${appName}! Your account has been created.\n\n` +
    `Login URL: ${opts.loginUrl}\n` +
    `Username: ${opts.username}\n` +
    `Password: ${opts.password}\n\n` +
    `For your security, please sign in and change your password as soon as possible.\n\n` +
    `If you did not expect this email, please contact your HR administrator.\n`;
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 8px;color:#111">Welcome to ${escapeHtml(appName)}</h2>
    <p style="margin:0 0 16px;color:#444">Hello <b>${escapeHtml(opts.employeeName)}</b>, your account has been created. You can now sign in with the credentials below.</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f6f8fb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:8px 0 16px;width:100%">
      <tr><td style="padding:6px 12px;color:#555;width:120px"><b>Login URL</b></td><td style="padding:6px 12px"><a href="${escapeHtml(opts.loginUrl)}" style="color:#2563eb">${escapeHtml(opts.loginUrl)}</a></td></tr>
      <tr><td style="padding:6px 12px;color:#555"><b>Username</b></td><td style="padding:6px 12px;font-family:Consolas,Menlo,monospace">${escapeHtml(opts.username)}</td></tr>
      <tr><td style="padding:6px 12px;color:#555"><b>Password</b></td><td style="padding:6px 12px;font-family:Consolas,Menlo,monospace">${escapeHtml(opts.password)}</td></tr>
    </table>
    <p style="margin:0 0 8px"><a href="${escapeHtml(opts.loginUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Sign in now</a></p>
    <p style="margin:16px 0 0;color:#666;font-size:12px">For your security, please change your password after your first sign-in. If you did not expect this email, contact your HR administrator.</p>
  </div>`;
  return { subject, html, text };
}