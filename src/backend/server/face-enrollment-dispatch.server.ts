// Sends face-enrollment alerts by email / push according to the employee's
// per-category preferences. Every attempt is recorded in notif_deliveries with
// payload.kind = "face_enrollment" so the admin history page can show it.
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";
import { sendPushTo } from "./web-push.server";

export async function dispatchFaceEnrollmentExternal(input: {
  userId: string;
  state: string;
  title: string;
  body: string;
  severity: string;
  email: boolean;
  push: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const payload = {
    kind: "face_enrollment",
    state: input.state,
    severity: input.severity,
    title: input.title,
    body: input.body,
    url: "/employee/biometrics",
  };
  const record = (row: Record<string, unknown>) =>
    sb.from("notif_deliveries").insert({ user_id: input.userId, subject: input.title, payload, ...row });

  const { data: prof } = await sb.from("profiles").select("email").eq("id", input.userId).maybeSingle();
  const email = prof?.email as string | undefined;

  if (!input.email) {
    await record({ channel: "email", recipient: email ?? null, status: "suppressed", error: "disabled by employee" });
  } else if (email) {
    const smtp = await loadSmtpConfig();
    if (!smtp || !smtp.host || !smtp.password) {
      await record({ channel: "email", recipient: email, status: "skipped_smtp", error: "SMTP not configured" });
    } else {
      const html = `<div style="font-family:sans-serif"><h2>${input.title}</h2><p>${input.body}</p></div>`;
      const res = await sendEmail(
        { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
        {
          from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
          fromEmail: smtp.from_email,
          to: [email],
          subject: input.title,
          html,
          text: input.body,
        },
      );
      await record({ channel: "email", recipient: email, status: res.ok ? "sent" : "failed", error: res.ok ? null : res.message });
    }
  }

  if (!input.push) {
    await record({ channel: "push", status: "suppressed", error: "disabled by employee" });
  } else {
    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_secret")
      .eq("user_id", input.userId);
    if (!subs?.length) {
      await record({ channel: "push", status: "failed", error: "no push subscription on any device" });
    } else {
      let ok = 0;
      let lastErr: string | undefined;
      for (const s of subs) {
        const r = await sendPushTo(s, { title: input.title, body: input.body, url: "/employee/biometrics", tag: "face-enrollment" });
        if (r.ok) ok++;
        else lastErr = r.error;
      }
      await record({ channel: "push", status: ok > 0 ? "sent" : "failed", error: ok > 0 ? null : lastErr ?? "push failed" });
    }
  }
}
