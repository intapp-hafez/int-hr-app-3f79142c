import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";
import { isQuietNow } from "./quiet-hours.server";
import { renderTaskNotifEmail } from "./email-render.server";

export type DispatchTaskNotif = {
  recipientUserIds: string[];
  employeeName: string;
  kind: "start_task" | "complete_task" | "start_trip" | "complete_trip";
  taskName: string;
  occurredAt: string;
  city?: string | null;
  district?: string | null;
  note?: string | null;
};

export async function dispatchTaskNotification(input: DispatchTaskNotif) {
  if (input.recipientUserIds.length === 0) return;

  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id, push_enabled, email_enabled, inapp_enabled, quiet_start, quiet_end, timezone")
    .in("user_id", input.recipientUserIds);
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", input.recipientUserIds);

  const prefMap = new Map((prefs ?? []).map((p) => [p.user_id, p]));
  const smtp = await loadSmtpConfig();

  const { subject, html, text } = renderTaskNotifEmail({
    employeeName: input.employeeName,
    kind: input.kind,
    taskName: input.taskName,
    occurredAt: input.occurredAt,
    city: input.city,
    district: input.district,
    note: input.note,
  });

  for (const prof of profs ?? []) {
    const pref = prefMap.get(prof.id) ?? {
      user_id: prof.id,
      push_enabled: true, email_enabled: true, inapp_enabled: true,
      quiet_start: null, quiet_end: null, timezone: "UTC",
    };
    const quiet = isQuietNow(pref.quiet_start, pref.quiet_end, pref.timezone);

    if (pref.inapp_enabled) {
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: prof.id, channel: "inapp", status: "sent",
        subject, payload: { kind: input.kind, taskName: input.taskName },
      });
    }

    if (!pref.email_enabled) {
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: prof.id, recipient: prof.email, channel: "email", status: "suppressed",
        subject, error: "email disabled",
      });
    } else if (quiet) {
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: prof.id, recipient: prof.email, channel: "email", status: "suppressed",
        subject, error: "quiet hours",
      });
    } else if (!smtp || !smtp.host || !smtp.password) {
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: prof.id, recipient: prof.email, channel: "email", status: "skipped_smtp",
        subject, error: "SMTP not configured",
      });
    } else if (prof.email) {
      const res = await sendEmail(
        { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
        {
          from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
          fromEmail: smtp.from_email,
          to: [prof.email],
          subject, html, text,
        },
      );
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: prof.id, recipient: prof.email, channel: "email",
        status: res.ok ? "sent" : "failed",
        subject, error: res.ok ? null : res.message,
      });
    }

    if (pref.push_enabled && !quiet) {
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: prof.id, channel: "push", status: "skipped_smtp",
        subject, error: "push transport not configured",
      });
    }
  }
}