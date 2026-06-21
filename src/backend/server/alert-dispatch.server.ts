// Central dispatcher for admin alert categories.
// - Reads each admin's per-category preferences from notification_category_prefs.
// - Sends in-app entries (notif_deliveries), email via SMTP, push via web-push.
// - Deduplicates per (user_id, channel, alert_id) so the same realtime event
//   isn't fanned out multiple times.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";
import { sendPushTo } from "./web-push.server";

export type AlertCategory = "pending_leave" | "late" | "absent" | "checkin" | "checkout";

export type AlertDispatchInput = {
  alertId: string; // stable id (e.g. `att-<row>`, `leave-<row>`)
  category: AlertCategory;
  title: string;
  body: string;
  url?: string;
};

const ADMIN_ROLES: string[] = ["admin", "hr", "manager"];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderEmail(input: AlertDispatchInput) {
  const subject = `[HR] ${input.title}`;
  const text = `${input.title}\n\n${input.body}`;
  const html = `<div style="font-family:system-ui,sans-serif;padding:16px">
    <h2 style="margin:0 0 8px">${escapeHtml(input.title)}</h2>
    <p style="margin:0 0 8px;color:#444">${escapeHtml(input.body)}</p>
    ${input.url ? `<p style="margin:12px 0 0"><a href="${escapeHtml(input.url)}" style="color:#2563eb">Open in dashboard</a></p>` : ""}
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
  const defaults = { pending_leave: { inapp: true, email: true, push: false },
                     late:         { inapp: true, email: true, push: true  },
                     absent:       { inapp: true, email: true, push: false },
                     checkin:      { inapp: true, email: false, push: false },
                     checkout:     { inapp: true, email: false, push: false } } as const;
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
          payload: { alert_id: input.alertId, category: input.category },
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
  return { recipients: recipients.length, sent };
}