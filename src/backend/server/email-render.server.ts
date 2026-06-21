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