import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationType = "renew" | "resign";
export type NotificationStatus = "pending" | "notified" | "confirmed" | "closed";

export type ContractNotificationRow = {
  id: string;
  profile_id: string;
  employee_name: string | null;
  employee_code: string | null;
  contract_end_date: string;
  type: NotificationType;
  status: NotificationStatus;
  notes: string | null;
  notified_at: string | null;
  confirmed_at: string | null;
  closed_at: string | null;
  days_remaining: number;
};

const DAY = 86_400_000;
function daysUntil(end: string) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(end); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export const listContractNotificationsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(25),
        q: z.string().max(120).optional().default(""),
        filter: z
          .enum(["all", "15", "30", "65", "renew", "resign", "pending", "notified", "confirmed", "closed"])
          .optional()
          .default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<{
    rows: ContractNotificationRow[];
    total: number;
  }> => {
    const { supabase } = context;
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let query = (supabase as any)
      .from("contract_notifications")
      .select("*, profiles!inner(id, full_name, emp_code, status)", { count: "exact" });

    // Ensure we only look at active employees for notifications
    query = query.eq("profiles.status", "Active");

    if (data.q) {
      const like = `%${data.q.replace(/[%_]/g, "")}%`;
      query = query.or(`profiles.full_name.ilike.${like},profiles.emp_code.ilike.${like}`);
    }

    if (["renew", "resign"].includes(data.filter)) {
      query = query.eq("type", data.filter);
    } else if (["pending", "notified", "confirmed", "closed"].includes(data.filter)) {
      query = query.eq("status", data.filter);
    } else if (["15", "30", "65"].includes(data.filter)) {
      const maxDays = Number(data.filter);
      const limitDate = new Date(today);
      limitDate.setDate(limitDate.getDate() + maxDays);
      const limitIso = `${limitDate.getFullYear()}-${String(limitDate.getMonth() + 1).padStart(2, '0')}-${String(limitDate.getDate()).padStart(2, '0')}`;
      query = query
        .gte("contract_end_date", todayIso)
        .lte("contract_end_date", limitIso);
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    query = query.order("contract_end_date", { ascending: true }).range(from, to);

    const { data: list, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows: ContractNotificationRow[] = (list ?? []).map((p: any) => ({
      id: p.id,
      profile_id: p.profile_id,
      employee_name: p.profiles?.full_name ?? null,
      employee_code: p.profiles?.emp_code ?? null,
      contract_end_date: p.contract_end_date,
      type: p.type,
      status: p.status,
      notes: p.notes,
      notified_at: p.notified_at,
      confirmed_at: p.confirmed_at,
      closed_at: p.closed_at,
      days_remaining: daysUntil(p.contract_end_date),
    }));

    return { rows, total: count ?? 0 };
  });

export const getContractNotificationStatsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const plusDaysIso = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const countQ = (build: (q: any) => any) =>
      build(
        (supabase as any)
          .from("contract_notifications")
          .select("id, profiles!inner(id, status)", { count: "exact", head: true })
          .eq("profiles.status", "Active"),
      );

    const [
      { count: total },
      { count: within15 },
      { count: within30 },
      { count: renew },
      { count: resign },
    ] = await Promise.all([
      countQ((q) => q),
      countQ((q) =>
        q.gte("contract_end_date", todayIso).lte("contract_end_date", plusDaysIso(15)),
      ),
      countQ((q) =>
        q.gte("contract_end_date", todayIso).lte("contract_end_date", plusDaysIso(30)),
      ),
      countQ((q) => q.eq("type", "renew")),
      countQ((q) => q.eq("type", "resign")),
    ]);

    return {
      total: total ?? 0,
      within15: within15 ?? 0,
      within30: within30 ?? 0,
      renew: renew ?? 0,
      resign: resign ?? 0,
    };
  });

export const setNotificationActionAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      type: z.enum(["renew", "resign"]),
      notes: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as any)
      .from("contract_notifications")
      .update({ type: data.type, notes: data.notes, status: "pending" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const notifyEmployeeAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error: fetchErr } = await (context.supabase as any)
      .from("contract_notifications")
      .select("*, profiles!inner(full_name, email)")
      .eq("id", data.id)
      .single();
    if (fetchErr || !row) throw new Error(fetchErr?.message || "Notification not found");
    
    try {
      const { loadSmtpConfig } = await import("@/backend/server/smtp-config.server");
      const { sendEmail } = await import("@/backend/server/smtp-client.server");
      const smtp = await loadSmtpConfig();
      if (smtp && smtp.host && smtp.password && row.profiles?.email) {
        const empName = row.profiles.full_name || "Employee";
        let emailHtml = "";
        let subject = "";
        if (row.type === "renew") {
          subject = `Important: Contract Renewal for ${empName}`;
          emailHtml = `<p>Dear ${empName},</p><p>We are pleased to inform you that we intend to renew your employment contract, which is currently set to expire on ${row.contract_end_date}.</p><p>Please contact HR for further details and next steps.</p>`;
        } else {
          subject = `Important: Contract Expiration Notice for ${empName}`;
          emailHtml = `<p>Dear ${empName},</p><p>This is a formal notice that your employment contract will conclude on its scheduled end date of ${row.contract_end_date}.</p><p>Please contact HR for further details regarding the transition process.</p>`;
        }
        
        await sendEmail(
          { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
          {
            from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
            fromEmail: smtp.from_email,
            to: [row.profiles.email],
            subject,
            html: emailHtml,
          }
        );
      } else {
        console.warn("SMTP config missing or employee has no email. Skipping real email send.");
      }
    } catch (err) {
      console.error("Failed to send email notification", err);
    }
    const { error } = await (context.supabase as any)
      .from("contract_notifications")
      .update({
        status: "notified",
        notified_at: new Date().toISOString(),
        notified_by: context.userId,
        notification_channel: "Email"
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmNotificationAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as any)
      .from("contract_notifications")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeNotificationAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as any)
      .from("contract_notifications")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export async function processContractNotifications() {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + 65);
  const limitIso = `${limitDate.getFullYear()}-${String(limitDate.getMonth() + 1).padStart(2, '0')}-${String(limitDate.getDate()).padStart(2, '0')}`;

  // 1. Find all active profiles whose contract_end_date is between today and +65 days.
  const { data: profiles, error: pError } = await supabaseAdmin
    .from("profiles")
    .select("id, contract_end_date")
    .eq("status", "Active")
    .gte("contract_end_date", todayIso)
    .lte("contract_end_date", limitIso);
    
  if (pError) {
    console.error("processContractNotifications error:", pError);
    return;
  }

  // 2. For each, try to insert a notification. Because of the UNIQUE constraint on (profile_id, contract_end_date), 
  // duplicate inserts will simply fail. We can use UPSERT with DO NOTHING or just insert and swallow duplicate errors.
  for (const p of (profiles ?? [])) {
    const { error } = await (supabaseAdmin as any).from("contract_notifications").insert({
      profile_id: p.id,
      contract_end_date: p.contract_end_date,
      type: "renew", // default intent
      status: "pending",
    });
    // Ignore duplicate key violation errors (23505)
    if (error && error.code !== '23505') {
      console.error(`Failed to create notification for profile ${p.id}:`, error);
    }
  }
}
