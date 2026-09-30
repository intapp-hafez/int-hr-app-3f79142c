// Shared user notification sender: in-app + email + real web push.
// Respects each user's notification_preferences (channel toggles + quiet hours).
// Never throws — notifications must not break the business action that caused them.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";
import { sendPushTo } from "./web-push.server";
import { isQuietNow } from "./quiet-hours.server";

export type NotifySeverity = "info" | "success" | "warning" | "danger";

export type NotifyInput = {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  category: string;
  severity?: NotifySeverity;
  /** skip email (e.g. low-importance events) */
  inAppOnly?: boolean;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderEmail(i: NotifyInput) {
  const color = i.severity === "danger" ? "#dc2626" : i.severity === "warning" ? "#ea580c" : i.severity === "success" ? "#16a34a" : "#2563eb";
  const html = `<div style="font-family:system-ui,sans-serif;padding:20px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;max-width:560px;margin:0 auto">
  <div style="height:4px;background:${color};border-radius:4px;margin-bottom:14px"></div>
  <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a">${esc(i.title)}</h2>
  <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5">${esc(i.body)}</p>
  ${i.url ? `<a href="${esc(i.url)}" style="display:inline-block;padding:8px 16px;border-radius:8px;background:${color};color:#fff;text-decoration:none;font-size:13px">Open</a>` : ""}
</div>`;
  return { subject: i.title, html, text: `${i.title}\n\n${i.body}` };
}

async function log(row: Record<string, unknown>) {
  try { await supabaseAdmin.from("notif_deliveries").insert(row as any); } catch { /* ignore */ }
}

export async function notifyUsers(input: NotifyInput): Promise<void> {
  try {
    const ids = Array.from(new Set(input.userIds.filter(Boolean)));
    if (ids.length === 0) return;
    const [{ data: prefs }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("notification_preferences")
        .select("user_id, push_enabled, email_enabled, inapp_enabled, quiet_start, quiet_end, timezone")
        .in("user_id", ids),
      supabaseAdmin.from("profiles").select("id, email").in("id", ids),
    ]);
    const prefMap = new Map((prefs ?? []).map((p) => [p.user_id, p]));
    const payload = { title: input.title, body: input.body, url: input.url, category: input.category, severity: input.severity ?? "info" };
    const email = renderEmail(input);
    let smtp: Awaited<ReturnType<typeof loadSmtpConfig>> | undefined;

    for (const prof of profs ?? []) {
      const p: any = prefMap.get(prof.id) ?? { push_enabled: true, email_enabled: true, inapp_enabled: true, quiet_start: null, quiet_end: null, timezone: "UTC" };
      const quiet = isQuietNow(p.quiet_start, p.quiet_end, p.timezone);

      // In-app always recorded unless user disabled it
      if (p.inapp_enabled !== false) {
        await log({ user_id: prof.id, channel: "inapp", status: "sent", subject: input.title, payload });
      }

      // Email
      if (!input.inAppOnly && p.email_enabled !== false && prof.email) {
        if (quiet) {
          await log({ user_id: prof.id, recipient: prof.email, channel: "email", status: "suppressed", subject: input.title, error: "quiet hours", payload });
        } else {
          if (smtp === undefined) smtp = await loadSmtpConfig().catch(() => null as any);
          if (!smtp || !smtp.host || !smtp.password) {
            await log({ user_id: prof.id, recipient: prof.email, channel: "email", status: "skipped_smtp", subject: input.title, error: "SMTP not configured", payload });
          } else {
            const res = await sendEmail(
              { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
              { from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email, fromEmail: smtp.from_email, to: [prof.email], ...email },
            ).catch((e: any) => ({ ok: false, message: e?.message ?? "send failed" }) as any);
            await log({ user_id: prof.id, recipient: prof.email, channel: "email", status: res.ok ? "sent" : "failed", subject: input.title, error: res.ok ? null : res.message, payload });
          }
        }
      }

      // Push
      if (p.push_enabled !== false && !quiet) {
        await pushToUser(prof.id, input, payload);
      }
    }
  } catch (e: any) {
    console.error("notifyUsers failed", e?.message);
  }
}

async function pushToUser(userId: string, input: NotifyInput, payload: Record<string, unknown>) {
  const { data: subs } = await (supabaseAdmin as any)
    .from("push_subscriptions").select("endpoint, p256dh, auth_secret").eq("user_id", userId);
  if (!subs || subs.length === 0) return; // user never enabled push on a device — nothing to log
  for (const s of subs as any[]) {
    const res = await sendPushTo(s, { title: input.title, body: input.body, url: input.url, tag: input.category });
    await log({ user_id: userId, channel: "push", status: res.ok ? "sent" : "failed", subject: input.title, error: res.ok ? null : res.error, payload });
    if (res.ok) {
      await (supabaseAdmin as any).from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("endpoint", s.endpoint);
    } else if (res.status === 404 || res.status === 410) {
      await (supabaseAdmin as any).from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }
}

export async function getManagerId(employeeId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("profiles").select("manager_id").eq("id", employeeId).maybeSingle();
  return ((data as any)?.manager_id as string) ?? null;
}

export async function getEmployeeName(employeeId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", employeeId).maybeSingle();
  return (data as any)?.full_name || (data as any)?.email || "An employee";
}

export async function listRoleUserIds(roles: string[]): Promise<string[]> {
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").in("role", roles as any);
  return Array.from(new Set((data ?? []).map((r: any) => r.user_id as string)));
}
