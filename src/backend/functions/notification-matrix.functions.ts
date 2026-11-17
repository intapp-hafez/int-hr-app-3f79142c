import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import {
  DEFAULT_NOTIFICATION_MATRIX,
  type NotificationMatrixRule,
} from "@/lib/notification-matrix.types";

const RuleUpdateSchema = z.object({
  id: z.string(),
  inapp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean(),
  receivers: z.object({
    notifyEmployee: z.boolean(),
    notifyManager: z.boolean(),
    notifyHr: z.boolean(),
    customEmails: z.array(z.string().email()),
  }),
  employeeTemplate: z.object({
    subject: z.string(),
    body: z.string(),
  }),
  responsibleTemplate: z.object({
    subject: z.string(),
    body: z.string(),
  }),
});

export const getNotificationMatrixRules = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async (): Promise<{ rules: NotificationMatrixRule[] }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: dbRows, error } = await supabaseAdmin
        .from("notification_matrix_rules" as any)
        .select("*");

      if (error || !dbRows || dbRows.length === 0) {
        return { rules: DEFAULT_NOTIFICATION_MATRIX };
      }

      const rowMap = new Map((dbRows as any[]).map((r) => [r.id, r]));

      const rules: NotificationMatrixRule[] = DEFAULT_NOTIFICATION_MATRIX.map((def) => {
        const row = rowMap.get(def.id);
        if (!row) return def;
        return {
          id: row.id,
          name: row.name || def.name,
          nameAr: row.name_ar || def.nameAr,
          description: row.description || def.description,
          descriptionAr: row.description_ar || def.descriptionAr,
          group: (row.category_group || def.group) as any,
          inapp: row.inapp ?? def.inapp,
          email: row.email ?? def.email,
          push: row.push ?? def.push,
          sms: row.sms ?? def.sms,
          receivers: {
            notifyEmployee: row.notify_employee ?? def.receivers.notifyEmployee,
            notifyManager: row.notify_manager ?? def.receivers.notifyManager,
            notifyHr: row.notify_hr ?? def.receivers.notifyHr,
            customEmails: Array.isArray(row.custom_emails) ? row.custom_emails : def.receivers.customEmails,
          },
          triggerSchedule: row.trigger_schedule || def.triggerSchedule,
          triggerScheduleAr: row.trigger_schedule_ar || def.triggerScheduleAr,
          triggerType: (row.trigger_type || def.triggerType) as any,
          employeeTemplate: {
            subject: row.employee_subject || def.employeeTemplate.subject,
            body: row.employee_body || def.employeeTemplate.body,
          },
          responsibleTemplate: {
            subject: row.responsible_subject || def.responsibleTemplate.subject,
            body: row.responsible_body || def.responsibleTemplate.body,
          },
        };
      });

      return { rules };
    } catch {
      return { rules: DEFAULT_NOTIFICATION_MATRIX };
    }
  });

export const saveNotificationMatrixRule = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => RuleUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      await supabaseAdmin.from("notification_matrix_rules" as any).upsert({
        id: data.id,
        inapp: data.inapp,
        email: data.email,
        push: data.push,
        sms: data.sms,
        notify_employee: data.receivers.notifyEmployee,
        notify_manager: data.receivers.notifyManager,
        notify_hr: data.receivers.notifyHr,
        custom_emails: data.receivers.customEmails,
        employee_subject: data.employeeTemplate.subject,
        employee_body: data.employeeTemplate.body,
        responsible_subject: data.responsibleTemplate.subject,
        responsible_body: data.responsibleTemplate.body,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    } catch (dbErr) {
      console.warn("Could not upsert notification_matrix_rules in DB:", dbErr);
    }

    try {
      await supabaseAdmin.from("security_audit_events").insert({
        event_type: "notification_matrix_rule_updated",
        details: { ruleId: data.id, receivers: data.receivers, channels: { inapp: data.inapp, email: data.email, push: data.push, sms: data.sms } },
      });
    } catch {
      // ignore audit logging error
    }

    return { ok: true, rule: data };
  });

export const sendTestMatrixNotification = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        ruleId: z.string(),
        targetAudience: z.enum(["employee", "responsible"]),
        recipientEmail: z.string().email(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { loadSmtpConfig } = await import("../server/smtp-config.server");
    const { sendEmail } = await import("../server/smtp-client.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rule = DEFAULT_NOTIFICATION_MATRIX.find((r) => r.id === data.ruleId);
    if (!rule) {
      return { ok: false, error: "Notification rule not found" };
    }

    const smtp = await loadSmtpConfig();
    if (!smtp || !smtp.host || !smtp.password) {
      return { ok: false, error: "SMTP is not configured. Please check your SMTP settings." };
    }

    const isEmp = data.targetAudience === "employee";
    const tpl = isEmp ? rule.employeeTemplate : rule.responsibleTemplate;

    const subject = `[TEST - ${isEmp ? "Employee Copy" : "Responsible Person Copy"}] ${tpl.subject
      .replace("{{employee_name}}", "Ahmed Mofreh")
      .replace("{{expiry_date}}", "30/11/2026")
      .replace("{{days_left}}", "13")}`;

    const text = tpl.body
      .replace(/\{\{employee_name\}\}/g, "Ahmed Mofreh")
      .replace(/\{\{expiry_date\}\}/g, "30/11/2026")
      .replace(/\{\{days_left\}\}/g, "13")
      .replace(/\{\{department\}\}/g, "Engineering & Maintenance")
      .replace(/\{\{leave_type\}\}/g, "Annual Leave")
      .replace(/\{\{start_date\}\}/g, "20/11/2026")
      .replace(/\{\{end_date\}\}/g, "24/11/2026");

    const badgeColor = isEmp ? "#2563eb" : "#ea580c";
    const badgeLabel = isEmp ? "DIRECT EMPLOYEE NOTICE" : "RESPONSIBLE PERSON / HR NOTICE";

    const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
  <div style="background:#0f172a;padding:20px 24px;border-bottom:1px solid #334155;">
    <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.05em;background:${badgeColor};color:#ffffff;">
      ${badgeLabel}
    </span>
    <h2 style="color:#ffffff;font-size:18px;margin:10px 0 0;font-weight:700;">${subject}</h2>
  </div>
  <div style="padding:24px;color:#334155;font-size:14px;line-height:1.6;">
    <p style="margin-top:0;">This is a test notification generated from the <strong>Notification Types & Dispatch Matrix</strong>.</p>
    <div style="background:#f8fafc;border-left:4px solid ${badgeColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:18px 0;font-size:14px;color:#1e293b;">
      ${text}
    </div>
    <div style="font-size:12px;color:#64748b;margin-top:16px;">
      Target Audience: <strong>${isEmp ? "Affected Employee" : "Responsible Person (Manager / HR)"}</strong><br/>
      Notification Event: <strong>${rule.name} (${rule.id})</strong>
    </div>
  </div>
  <div style="background:#f1f5f9;padding:12px 24px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;">
    Integrated Technics — Automated HR Dispatch System
  </div>
</div>`;

    const res = await sendEmail(
      { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
      {
        from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
        fromEmail: smtp.from_email,
        to: [data.recipientEmail],
        subject,
        text,
        html,
      },
    );

    // Record into notif_deliveries
    await supabaseAdmin.from("notif_deliveries").insert({
      recipient: data.recipientEmail,
      channel: "email",
      status: res.ok ? "sent" : "failed",
      subject,
      error: res.ok ? null : res.message,
      payload: {
        category: rule.id,
        rule_name: rule.name,
        target_audience: data.targetAudience,
        is_matrix_test: true,
        body: text,
        html,
      },
    });

    return { ok: res.ok, error: res.ok ? null : res.message };
  });
