// Dispatches leave-decision notifications to the affected employee across
// in-app, email (SMTP), and web-push channels. Called from staffDecideLeave
// whenever an admin/HR approves, re-opens (approved), rejects, or cancels
// (revokes) a leave request from the attendance calendar.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";
import { sendPushTo } from "./web-push.server";
import { isQuietNow } from "./quiet-hours.server";

export type LeaveDecisionKind = "approved" | "reopened" | "revoked" | "rejected";

export type DispatchLeaveDecision = {
  employeeId: string;
  leaveId: string;
  kind: LeaveDecisionKind;
  leaveTypeName: string | null;
  startDate: string;
  endDate: string;
  days?: number | null;
  paid?: boolean | null;
  decidedByName?: string | null;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function render(input: DispatchLeaveDecision, employeeName: string | null) {
  const label = input.leaveTypeName ?? "Leave";
  const verb =
    input.kind === "approved"
      ? "approved"
      : input.kind === "reopened"
      ? "re-opened"
      : input.kind === "revoked"
      ? "revoked"
      : "rejected";
  const subject = `Your ${label} request has been ${verb}`;
  const range =
    input.startDate === input.endDate
      ? input.startDate
      : `${input.startDate} → ${input.endDate}`;
  const paidStr = input.paid == null ? "" : input.paid ? " (paid)" : " (unpaid)";
  const daysStr = input.days ? ` · ${input.days} day${input.days === 1 ? "" : "s"}` : "";
  const greeting = employeeName ? `Hi ${employeeName},` : "Hello,";
  const text = `${greeting}\n\nYour ${label} request for ${range}${daysStr}${paidStr} has been ${verb}.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:20px;color:#111">
    <h2 style="margin:0 0 12px">${esc(subject)}</h2>
    <p style="margin:0 0 8px">${esc(greeting)}</p>
    <p style="margin:0 0 8px">Your <strong>${esc(label)}</strong> request has been <strong>${esc(verb)}</strong>.</p>
    <table style="border-collapse:collapse;margin:8px 0 0">
      <tr><td style="padding:4px 12px 4px 0;color:#555">Dates</td><td style="padding:4px 0"><strong>${esc(range)}</strong></td></tr>
      ${input.days ? `<tr><td style="padding:4px 12px 4px 0;color:#555">Days</td><td style="padding:4px 0">${input.days}</td></tr>` : ""}
      ${input.paid != null ? `<tr><td style="padding:4px 12px 4px 0;color:#555">Pay</td><td style="padding:4px 0">${input.paid ? "Paid" : "Unpaid"}</td></tr>` : ""}
      ${input.decidedByName ? `<tr><td style="padding:4px 12px 4px 0;color:#555">By</td><td style="padding:4px 0">${esc(input.decidedByName)}</td></tr>` : ""}
    </table>
  </div>`;
  return { subject, html, text, verb, range };
}

export async function dispatchLeaveDecision(input: DispatchLeaveDecision) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", input.employeeId)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "employee-not-found" };

  const { data: pref } = await supabaseAdmin
    .from("notification_preferences")
    .select("push_enabled, email_enabled, inapp_enabled, quiet_start, quiet_end, timezone")
    .eq("user_id", input.employeeId)
    .maybeSingle();
  const p = pref ?? { push_enabled: true, email_enabled: true, inapp_enabled: true, quiet_start: null, quiet_end: null, timezone: "UTC" };
  const quiet = isQuietNow(p.quiet_start as any, p.quiet_end as any, (p.timezone as any) ?? "UTC");

  const { subject, html, text, verb } = render(input, profile.full_name ?? null);
  const payload = {
    kind: "leave_decision",
    decision: input.kind,
    leave_id: input.leaveId,
    leave_type_name: input.leaveTypeName,
    start_date: input.startDate,
    end_date: input.endDate,
    days: input.days ?? null,
    paid: input.paid ?? null,
  };

  // In-app
  if (p.inapp_enabled) {
    await supabaseAdmin.from("notif_deliveries").insert({
      user_id: input.employeeId, channel: "inapp", status: "delivered",
      subject, payload,
    });
  }

  // Email
  if (!p.email_enabled) {
    await supabaseAdmin.from("notif_deliveries").insert({
      user_id: input.employeeId, recipient: profile.email, channel: "email",
      status: "suppressed", subject, error: "email disabled", payload,
    });
  } else if (quiet) {
    await supabaseAdmin.from("notif_deliveries").insert({
      user_id: input.employeeId, recipient: profile.email, channel: "email",
      status: "suppressed", subject, error: "quiet hours", payload,
    });
  } else if (profile.email) {
    const smtp = await loadSmtpConfig();
    if (!smtp || !smtp.host || !smtp.password) {
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: input.employeeId, recipient: profile.email, channel: "email",
        status: "skipped_smtp", subject, error: "SMTP not configured", payload,
      });
    } else {
      const res = await sendEmail(
        { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
        {
          from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
          fromEmail: smtp.from_email,
          to: [profile.email],
          subject, html, text,
        },
      );
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: input.employeeId, recipient: profile.email, channel: "email",
        status: res.ok ? "sent" : "failed",
        subject, error: res.ok ? null : res.message, payload,
      });
    }
  }

  // Push
  if (p.push_enabled && !quiet) {
    const { data: subs } = await (supabaseAdmin as any)
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_secret")
      .eq("user_id", input.employeeId);
    if (!subs || subs.length === 0) {
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: input.employeeId, channel: "push", status: "skipped_smtp",
        subject, error: "no push subscription", payload,
      });
    } else {
      for (const s of subs as any[]) {
        const res = await sendPushTo(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth_secret: s.auth_secret },
          { title: subject, body: `${input.startDate} → ${input.endDate}`, url: "/employee/leaves", tag: `leave-${input.leaveId}` },
        );
        await supabaseAdmin.from("notif_deliveries").insert({
          user_id: input.employeeId, channel: "push",
          status: res.ok ? "sent" : "failed",
          subject, error: res.ok ? null : res.error, payload,
        });
        if (res.ok) {
          await (supabaseAdmin as any).from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
            .eq("endpoint", s.endpoint);
        } else if (res.status === 404 || res.status === 410) {
          await (supabaseAdmin as any).from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
  }

  return { ok: true, verb };
}
/**
 * Copies the decision to the employee's manager and to all admins / HR, so the
 * chain of command sees approvals and rejections, not just the employee.
 */
export async function dispatchLeaveDecisionToStaff(
  input: DispatchLeaveDecision & { employeeName?: string | null },
) {
  try {
    const { data: employee } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, manager_id")
      .eq("id", input.employeeId)
      .maybeSingle();

    const recipients = new Set<string>();
    const staffUserIds = new Set<string>();

    if ((employee as any)?.manager_id) {
      staffUserIds.add((employee as any).manager_id);
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
    for (const uid of ids) {
      staffUserIds.add(uid);
    }
    if (ids.length) {
      const { data: rows } = await supabaseAdmin.from("profiles").select("email").in("id", ids);
      for (const r of (rows ?? []) as any[]) if (r.email) recipients.add(r.email);
    }
    if ((employee as any)?.email) recipients.delete((employee as any).email);
    staffUserIds.delete(input.employeeId);

    const who = (employee as any)?.full_name ?? (employee as any)?.email ?? input.employeeId;
    const base = render(input, who);
    const subject = `[Team] ${who}: ${input.leaveTypeName ?? "Leave"} ${base.verb}`;
    const text = `${who}'s ${input.leaveTypeName ?? "leave"} request for ${base.range} has been ${base.verb}${
      input.decidedByName ? ` by ${input.decidedByName}` : ""
    }.`;
    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:20px;color:#111">
      <h2 style="margin:0 0 12px">${esc(subject)}</h2>
      <p style="margin:0 0 8px">${esc(text)}</p>
    </div>`;

    // 1. Deliver in-app notification to manager and HR/admins
    if (staffUserIds.size > 0) {
      try {
        const inAppRows = Array.from(staffUserIds).map((uid) => ({
          user_id: uid,
          channel: "inapp",
          status: "delivered",
          subject,
          payload: {
            kind: "leave_decision",
            decision: input.kind,
            employee_id: input.employeeId,
            employee_name: who,
            leave_id: input.leaveId,
            leave_type_name: input.leaveTypeName,
            start_date: input.startDate,
            end_date: input.endDate,
            days: input.days ?? null,
            paid: input.paid ?? null,
            decided_by_name: input.decidedByName ?? null,
          },
        }));
        await supabaseAdmin.from("notif_deliveries").insert(inAppRows);
      } catch (inAppErr) {
        console.error("[dispatchLeaveDecisionToStaff] in-app insert error:", inAppErr);
      }
    }

    // 2. Deliver email via SMTP
    if (recipients.size === 0) return { ok: true, inAppOnly: true };

    const smtp = await loadSmtpConfig();
    if (!smtp || !smtp.host || !smtp.password) return { ok: true, inAppOnly: true, reason: "smtp-not-configured" };
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
    return { ok: false, reason: "error" };
  }
}
