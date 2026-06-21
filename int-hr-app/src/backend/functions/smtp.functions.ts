import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { SmtpConfigSchema } from "../schemas";

export const getSmtpConfig = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("smtp_config")
      .select("host, port, secure, username, from_email, from_name, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveSmtpConfig = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => SmtpConfigSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { writeSmtpConfig } = await import("../server/smtp-config.server");
    await writeSmtpConfig({ ...data, updated_by: context.userId });
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => {
    if (!input || typeof input !== "object") throw new Error("invalid");
    const to = (input as { to?: unknown }).to;
    if (typeof to !== "string" || !/.+@.+/.test(to)) throw new Error("invalid recipient");
    return { to };
  })
  .handler(async ({ data }) => {
    const { loadSmtpConfig } = await import("../server/smtp-config.server");
    const { sendEmail } = await import("../server/smtp-client.server");
    const smtp = await loadSmtpConfig();
    if (!smtp || !smtp.host || !smtp.password) {
      return { ok: false, error: "SMTP not configured (host/password missing)" };
    }
    const res = await sendEmail(
      { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
      {
        from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
        fromEmail: smtp.from_email,
        to: [data.to],
        subject: "Test email from HR backend",
        text: "If you received this, SMTP is wired correctly.",
        html: `<p>If you received this, SMTP is wired correctly.</p>`,
      },
    );
    return { ok: res.ok, error: res.ok ? null : res.message };
  });