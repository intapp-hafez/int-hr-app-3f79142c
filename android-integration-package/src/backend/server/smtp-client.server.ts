/**
 * SMTP client wrapper.
 *
 * This app runs as an SPA, so server functions execute in the browser. Raw
 * TCP/TLS from the browser is impossible — instead we delegate the actual
 * SMTP send to a Supabase Edge Function (Deno) that the authenticated
 * admin/HR user invokes.
 */
import { supabase } from "@/integrations/supabase/client";

export type SmtpAuth = {
  host: string;
  port: number;
  secure: boolean; // true = implicit TLS (465); false = STARTTLS upgrade
  username: string;
  password: string;
};

export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
  contentType: string;
};

export type SmtpMessage = {
  from: string; // "Name <addr@x>" or "addr@x"
  fromEmail: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export type SmtpResult = {
  ok: boolean;
  code?: number;
  message?: string;
  log?: string[];
};

export async function sendEmail(auth: SmtpAuth, msg: SmtpMessage): Promise<SmtpResult> {
  try {
    // Attachments are not supported via the edge function path yet.
    const payload = {
      auth,
      msg: {
        from: msg.from,
        fromEmail: msg.fromEmail,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      },
    };
    const { data, error } = await supabase.functions.invoke("send-smtp-email", { body: payload });
    if (error) return { ok: false, message: error.message ?? "Edge function error" };
    const res = (data ?? {}) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, message: res.error ?? "Send failed" };
    return { ok: true, code: 250, message: "OK" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}