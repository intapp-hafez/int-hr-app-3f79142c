import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

export type EmailDeliveryLogItem = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string;
  recipient: string | null;
  channel: string;
  status: "sent" | "failed" | "suppressed" | "skipped_smtp" | "queued" | string;
  subject: string | null;
  error: string | null;
  category: string | null;
  body: string | null;
  html: string | null;
};

export type EmailLogStats = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
};

export const listEmailLogs = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        days: z.number().int().min(1).max(365).default(30),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{ logs: EmailDeliveryLogItem[]; stats: EmailLogStats }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("notif_deliveries")
      .select("id, created_at, user_id, recipient, channel, status, subject, error, payload")
      .eq("channel", "email")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      throw new Error(error.message);
    }

    const rawRows = rows ?? [];

    // Collect profile user IDs
    const userIds = Array.from(new Set(rawRows.map((r) => r.user_id).filter(Boolean))) as string[];
    const nameMap = new Map<string, string>();
    const emailMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      for (const p of (profs ?? []) as any[]) {
        nameMap.set(p.id, p.full_name || p.email || "—");
        if (p.email) emailMap.set(p.id, p.email);
      }
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const logs: EmailDeliveryLogItem[] = rawRows.map((r: any) => {
      const p = (r.payload ?? {}) as Record<string, any>;
      const s = String(r.status || "").toLowerCase();

      if (/sent|delivered|ok/i.test(s)) sent++;
      else if (/fail|error/i.test(s)) failed++;
      else skipped++;

      return {
        id: r.id,
        created_at: r.created_at,
        user_id: r.user_id,
        user_name: r.user_id ? nameMap.get(r.user_id) ?? "—" : "—",
        recipient: r.recipient || (r.user_id ? emailMap.get(r.user_id) : null) || p.recipient || p.to || null,
        channel: r.channel,
        status: r.status,
        subject: r.subject || p.title || p.subject || "(No Subject)",
        error: r.error,
        category: p.category || p.kind || "general",
        body: p.body || p.text || null,
        html: p.html || null,
      };
    });

    return {
      logs,
      stats: {
        total: logs.length,
        sent,
        failed,
        skipped,
      },
    };
  });

export const resendEmailLog = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        deliveryId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSmtpConfig } = await import("../server/smtp-config.server");
    const { sendEmail } = await import("../server/smtp-client.server");

    const { data: row, error } = await supabaseAdmin
      .from("notif_deliveries")
      .select("id, user_id, recipient, subject, payload")
      .eq("id", data.deliveryId)
      .maybeSingle();

    if (error || !row) {
      return { ok: false, error: "Email delivery log record not found" };
    }

    let recipient = row.recipient;
    if (!recipient && row.user_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", row.user_id)
        .maybeSingle();
      recipient = prof?.email ?? null;
    }

    if (!recipient) {
      return { ok: false, error: "No recipient email address found for this log" };
    }

    const smtp = await loadSmtpConfig();
    if (!smtp || !smtp.host || !smtp.password) {
      return { ok: false, error: "SMTP is not configured. Please check your SMTP settings." };
    }

    const p = (row.payload ?? {}) as Record<string, any>;
    const subject = row.subject || p.title || "Notification from HR Portal";
    const text = p.body || p.text || subject;
    const html = p.html || `<div style="font-family:sans-serif;padding:16px;"><h2>${subject}</h2><p>${text}</p></div>`;

    const res = await sendEmail(
      { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
      {
        from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
        fromEmail: smtp.from_email,
        to: [recipient],
        subject,
        text,
        html,
      },
    );

    // Insert a new delivery log record for this retry
    await supabaseAdmin.from("notif_deliveries").insert({
      user_id: row.user_id,
      recipient,
      channel: "email",
      status: res.ok ? "sent" : "failed",
      subject: `[Resent] ${subject}`,
      error: res.ok ? null : res.message,
      payload: {
        ...p,
        retried_from_id: row.id,
        retried_at: new Date().toISOString(),
      },
    });

    return { ok: res.ok, error: res.ok ? null : res.message };
  });
