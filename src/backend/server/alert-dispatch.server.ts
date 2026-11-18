// Central dispatcher for admin alert categories.
// - Reads each admin's per-category preferences from notification_category_prefs.
// - Sends in-app entries (notif_deliveries), email via SMTP, push via web-push.
// - Deduplicates per (user_id, channel, alert_id) so the same realtime event
//   isn't fanned out multiple times.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";
import { sendPushTo } from "./web-push.server";

export type AlertCategory =
  | "id_expiry"
  | "contract_expiry"
  | "insurance_expiry"
  | "military_expiry"
  | "probation_end"
  | "pending_leave"
  | "advance_payment"
  | "late"
  | "absent"
  | "checkin"
  | "checkout";

export type AlertDispatchInput = {
  alertId: string; // stable id (e.g. `att-<row>`, `leave-<row>`)
  category: AlertCategory;
  title: string;
  body: string;
  url?: string;
  employeeId?: string; // Optional target employee being alerted about
  responsibleEmails?: string[]; // Optional extra responsible CC emails
  notifyEmployee?: boolean;
  notifyManager?: boolean;
};

const ADMIN_ROLES: string[] = ["admin", "hr"];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderEmail(input: AlertDispatchInput) {
  const isExp = input.category.includes("expiry") || input.category === "probation_end";
  const badgeColor = isExp ? "#dc2626" : input.category === "late" ? "#ea580c" : "#2563eb";
  const subject = isExp ? `[HR Urgent] ${input.title}` : `[HR Alert] ${input.title}`;
  const text = `${input.title}\n\n${input.body}${input.url ? `\n\nLink: ${input.url}` : ""}`;
  const html = `<div style="font-family:system-ui,sans-serif;padding:20px;border-radius:12px;border:1px solid #e2e8f0;background:#ffffff;max-width:560px;margin:0 auto">
    <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${badgeColor}15;color:${badgeColor};margin-bottom:12px">
      ${isExp ? "DOCUMENT & STATUS EXPIRATION" : "HR NOTIFICATION"}
    </div>
    <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a">${escapeHtml(input.title)}</h2>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5">${escapeHtml(input.body)}</p>
    ${input.url ? `<a href="${escapeHtml(input.url)}" style="display:inline-block;padding:8px 16px;border-radius:8px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:500">Review in Dashboard</a>` : ""}
  </div>`;
  return { subject, html, text };
}

function renderEmployeeEmail(input: AlertDispatchInput, employeeName: string) {
  const isExp = input.category.includes("expiry") || input.category === "probation_end";
  const badgeColor = isExp ? "#dc2626" : "#2563eb";
  const subject = isExp ? `[Action Required] ${input.title}` : `[HR Notice] ${input.title}`;
  const text = `Dear ${employeeName},\n\n${input.body}\n\nPlease take the necessary action before the deadline.${input.url ? `\n\nLink: ${input.url}` : ""}`;
  const html = `<div style="font-family:system-ui,sans-serif;padding:20px;border-radius:12px;border:1px solid #e2e8f0;background:#ffffff;max-width:560px;margin:0 auto">
    <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${badgeColor}15;color:${badgeColor};margin-bottom:12px">
      ${isExp ? "ACTION REQUIRED FOR YOUR ATTENTION" : "PERSONAL HR NOTIFICATION"}
    </div>
    <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a">${escapeHtml(input.title)}</h2>
    <p style="margin:0 0 12px;color:#0f172a;font-weight:600;font-size:14px">Dear ${escapeHtml(employeeName)},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5">${escapeHtml(input.body)}</p>
    ${input.url ? `<a href="${escapeHtml(input.url)}" style="display:inline-block;padding:8px 16px;border-radius:8px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:500">Access Employee Portal</a>` : ""}
  </div>`;
  return { subject, html, text };
}

function renderResponsibleManagerEmail(input: AlertDispatchInput, employeeName: string, managerName: string) {
  const isExp = input.category.includes("expiry") || input.category === "probation_end";
  const badgeColor = isExp ? "#ea580c" : "#7c3aed";
  const subject = `[Follow-up Required] ${employeeName}: ${input.title}`;
  const text = `Dear ${managerName},\n\nThis is a supervisory notification regarding your team member ${employeeName}.\n${input.body}\n\nThe employee has been notified directly. Please ensure required follow-up is completed before the deadline.${input.url ? `\n\nLink: ${input.url}` : ""}`;
  const html = `<div style="font-family:system-ui,sans-serif;padding:20px;border-radius:12px;border:1px solid #e2e8f0;background:#ffffff;max-width:560px;margin:0 auto">
    <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${badgeColor}15;color:${badgeColor};margin-bottom:12px">
      SUPERVISORY & RESPONSIBLE FOLLOW-UP
    </div>
    <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a">${escapeHtml(input.title)}</h2>
    <p style="margin:0 0 12px;color:#0f172a;font-weight:600;font-size:14px">Dear ${escapeHtml(managerName)},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5">${escapeHtml(input.body)}</p>
    <div style="background:#f8fafc;padding:12px;border-radius:8px;font-size:13px;color:#475569;margin-bottom:16px;">
      Target Employee: <strong>${escapeHtml(employeeName)}</strong><br/>
      Status: Employee has been notified directly. Follow-up is required.
    </div>
    ${input.url ? `<a href="${escapeHtml(input.url)}" style="display:inline-block;padding:8px 16px;border-radius:8px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:500">Review Team Record</a>` : ""}
  </div>`;
  return { subject, html, text };
}

async function listAdminRecipients(): Promise<{ id: string; email: string | null; full_name: string | null }[]> {
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ADMIN_ROLES as any);
  const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id as string)));
  if (ids.length === 0) return [];
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", ids);
  return (profs ?? []) as any;
}

async function loadPrefs(userIds: string[], category: AlertCategory) {
  if (userIds.length === 0) return new Map<string, { inapp: boolean; email: boolean; push: boolean }>();
  const { data } = await (supabaseAdmin as any)
    .from("notification_category_prefs")
    .select("user_id, channel, enabled")
    .in("user_id", userIds)
    .eq("category", category);
  // sensible defaults when a user has no rows yet
  const defaults: Record<AlertCategory, { inapp: boolean; email: boolean; push: boolean }> = {
    id_expiry:       { inapp: true, email: true,  push: true  },
    contract_expiry: { inapp: true, email: true,  push: true  },
    insurance_expiry:{ inapp: true, email: true,  push: false },
    military_expiry: { inapp: true, email: false, push: false },
    probation_end:   { inapp: true, email: true,  push: false },
    pending_leave:   { inapp: true, email: true,  push: false },
    advance_payment: { inapp: true, email: true,  push: false },
    late:            { inapp: true, email: true,  push: true  },
    absent:          { inapp: true, email: true,  push: false },
    checkin:         { inapp: true, email: false, push: false },
    checkout:        { inapp: true, email: false, push: false },
  };
  const map = new Map<string, { inapp: boolean; email: boolean; push: boolean }>();
  for (const uid of userIds) map.set(uid, { ...defaults[category] });
  for (const row of (data ?? []) as any[]) {
    const cur = map.get(row.user_id)!;
    if (row.channel === "inapp") cur.inapp = !!row.enabled;
    if (row.channel === "email") cur.email = !!row.enabled;
    if (row.channel === "push")  cur.push  = !!row.enabled;
  }
  return map;
}

async function alreadyDelivered(userId: string, channel: "inapp" | "email" | "push", alertId: string) {
  const { data } = await supabaseAdmin
    .from("notif_deliveries")
    .select("id")
    .eq("user_id", userId)
    .eq("channel", channel)
    .contains("payload", { alert_id: alertId })
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function dispatchAlert(input: AlertDispatchInput) {
  const recipients = await listAdminRecipients();
  if (recipients.length === 0) return { recipients: 0, sent: 0 };
  const prefMap = await loadPrefs(recipients.map((r) => r.id), input.category);
  const smtp = await loadSmtpConfig();
  const { subject, html, text } = renderEmail(input);
  let sent = 0;

  for (const rec of recipients) {
    const pref = prefMap.get(rec.id)!;

    // In-app
    if (pref.inapp && !(await alreadyDelivered(rec.id, "inapp", input.alertId))) {
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: rec.id, channel: "inapp", status: "sent",
        subject: input.title,
        payload: { alert_id: input.alertId, category: input.category, body: input.body, url: input.url },
      });
      sent++;
    }

    // Email
    if (pref.email && rec.email && !(await alreadyDelivered(rec.id, "email", input.alertId))) {
      if (!smtp || !smtp.host || !smtp.password) {
        await supabaseAdmin.from("notif_deliveries").insert({
          user_id: rec.id, recipient: rec.email, channel: "email", status: "skipped_smtp",
          subject, error: "SMTP not configured", payload: { alert_id: input.alertId },
        });
      } else {
        const res = await sendEmail(
          { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
          {
            from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
            fromEmail: smtp.from_email,
            to: [rec.email],
            subject, html, text,
          },
        );
        await supabaseAdmin.from("notif_deliveries").insert({
          user_id: rec.id, recipient: rec.email, channel: "email",
          status: res.ok ? "sent" : "failed",
          subject, error: res.ok ? null : res.message,
          payload: { alert_id: input.alertId, category: input.category, body: input.body, url: input.url, html },
        });
        if (res.ok) sent++;
      }
    }

    // Push
    if (pref.push && !(await alreadyDelivered(rec.id, "push", input.alertId))) {
      const { data: subs } = await (supabaseAdmin as any)
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth_secret")
        .eq("user_id", rec.id);
      if (!subs || subs.length === 0) {
        await supabaseAdmin.from("notif_deliveries").insert({
          user_id: rec.id, channel: "push", status: "skipped_smtp",
          subject: input.title, error: "no push subscription",
          payload: { alert_id: input.alertId },
        });
      } else {
        for (const s of subs as any[]) {
          const res = await sendPushTo(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth_secret: s.auth_secret },
            { title: input.title, body: input.body, url: input.url, tag: input.category },
          );
          await supabaseAdmin.from("notif_deliveries").insert({
            user_id: rec.id, channel: "push",
            status: res.ok ? "sent" : "failed",
            subject: input.title, error: res.ok ? null : res.error,
            payload: { alert_id: input.alertId, category: input.category },
          });
          if (res.ok) {
            await (supabaseAdmin as any).from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("endpoint", s.endpoint);
            sent++;
          } else if (res.status === 404 || res.status === 410) {
            // expired subscription
            await (supabaseAdmin as any).from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Dual-Audience Dispatch: Affected Employee & Responsible Manager
  // -------------------------------------------------------------
  if (input.employeeId) {
    try {
      const { data: empProf } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name, manager_id")
        .eq("id", input.employeeId)
        .maybeSingle();

      if (empProf) {
        const empName = empProf.full_name || "Employee";

        // 1. Direct Employee Dispatch (if enabled)
        if (input.notifyEmployee !== false && empProf.email && smtp?.host && smtp?.password) {
          const empAlertId = `${input.alertId}-emp`;
          if (!(await alreadyDelivered(empProf.id, "email", empAlertId))) {
            const empEmailData = renderEmployeeEmail(input, empName);
            const empRes = await sendEmail(
              { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
              {
                from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
                fromEmail: smtp.from_email,
                to: [empProf.email],
                subject: empEmailData.subject,
                html: empEmailData.html,
                text: empEmailData.text,
              },
            );
            await supabaseAdmin.from("notif_deliveries").insert({
              user_id: empProf.id,
              recipient: empProf.email,
              channel: "email",
              status: empRes.ok ? "sent" : "failed",
              subject: empEmailData.subject,
              error: empRes.ok ? null : empRes.message,
              payload: {
                alert_id: empAlertId,
                category: input.category,
                target_audience: "employee",
                body: empEmailData.text,
                html: empEmailData.html,
              },
            });
            if (empRes.ok) sent++;
          }
        }

        // 2. Direct Line Manager Dispatch (if enabled and manager exists)
        if (input.notifyManager !== false && empProf.manager_id && smtp?.host && smtp?.password) {
          const { data: mgrProf } = await supabaseAdmin
            .from("profiles")
            .select("id, email, full_name")
            .eq("id", empProf.manager_id)
            .maybeSingle();

          if (mgrProf?.email) {
            const mgrAlertId = `${input.alertId}-mgr`;
            if (!(await alreadyDelivered(mgrProf.id, "email", mgrAlertId))) {
              const mgrName = mgrProf.full_name || "Manager";
              const mgrEmailData = renderResponsibleManagerEmail(input, empName, mgrName);
              const mgrRes = await sendEmail(
                { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
                {
                  from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
                  fromEmail: smtp.from_email,
                  to: [mgrProf.email],
                  subject: mgrEmailData.subject,
                  html: mgrEmailData.html,
                  text: mgrEmailData.text,
                },
              );
              await supabaseAdmin.from("notif_deliveries").insert({
                user_id: mgrProf.id,
                recipient: mgrProf.email,
                channel: "email",
                status: mgrRes.ok ? "sent" : "failed",
                subject: mgrEmailData.subject,
                error: mgrRes.ok ? null : mgrRes.message,
                payload: {
                  alert_id: mgrAlertId,
                  category: input.category,
                  target_audience: "manager",
                  employee_name: empName,
                  body: mgrEmailData.text,
                  html: mgrEmailData.html,
                },
              });
              if (mgrRes.ok) sent++;
            }
          }
        }
      }
    } catch (dualErr) {
      console.warn("Dual-audience alert dispatch failed:", dualErr);
    }
  }

  // 3. Additional Responsible CC Emails
  if (Array.isArray(input.responsibleEmails) && input.responsibleEmails.length > 0 && smtp?.host && smtp?.password) {
    for (const ccEmail of input.responsibleEmails) {
      if (/.+@.+\..+/.test(ccEmail)) {
        try {
          const ccAlertId = `${input.alertId}-cc-${ccEmail}`;
          const ccEmailData = renderEmail(input);
          const ccRes = await sendEmail(
            { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
            {
              from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
              fromEmail: smtp.from_email,
              to: [ccEmail],
              subject: `[CC] ${ccEmailData.subject}`,
              html: ccEmailData.html,
              text: ccEmailData.text,
            },
          );
          await supabaseAdmin.from("notif_deliveries").insert({
            recipient: ccEmail,
            channel: "email",
            status: ccRes.ok ? "sent" : "failed",
            subject: `[CC] ${ccEmailData.subject}`,
            error: ccRes.ok ? null : ccRes.message,
            payload: {
              alert_id: ccAlertId,
              category: input.category,
              target_audience: "responsible_cc",
              body: ccEmailData.text,
              html: ccEmailData.html,
            },
          });
          if (ccRes.ok) sent++;
        } catch (ccErr) {
          console.warn("Responsible CC send error:", ccErr);
        }
      }
    }
  }

  return { recipients: recipients.length, sent };
}