/**
 * Loads + decrypts the singleton SMTP configuration. Server-only.
 * Uses pgp_sym_encrypt/decrypt with SMTP_ENCRYPTION_KEY at rest.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LoadedSmtp = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
};

function key(): string {
  return process.env.SMTP_ENCRYPTION_KEY || "dev-fallback-key-change-me";
}

export async function loadSmtpConfig(): Promise<LoadedSmtp | null> {
  // Decrypt server-side via a one-shot SQL call so the key never sits in JS for long.
  const { data, error } = await (supabaseAdmin as any).rpc("smtp_config_decrypt", { _key: key() });
  if (error) {
    // RPC missing? fall back to raw row (only fields without password).
    const { data: row } = await supabaseAdmin
      .from("smtp_config")
      .select("host, port, secure, username, from_email, from_name")
      .eq("id", 1)
      .maybeSingle();
    if (!row) return null;
    return {
      host: row.host,
      port: row.port,
      secure: row.secure,
      username: row.username,
      password: "",
      from_email: row.from_email,
      from_name: row.from_name,
    };
  }
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const r = Array.isArray(data) ? data[0] : data;
  return {
    host: r.host,
    port: r.port,
    secure: r.secure,
    username: r.username,
    password: r.password ?? "",
    from_email: r.from_email,
    from_name: r.from_name,
  };
}

export async function writeSmtpConfig(input: {
  host: string; port: number; secure: boolean; username: string;
  password?: string; from_email: string; from_name: string;
  updated_by?: string;
}) {
  // Build update set; only re-encrypt password when provided.
  const base = {
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    from_email: input.from_email,
    from_name: input.from_name,
    updated_by: input.updated_by ?? null,
  };
  // Ensure row exists
  await supabaseAdmin.from("smtp_config").upsert({ id: 1, ...base });
  if (input.password && input.password.length > 0) {
    const { error } = await (supabaseAdmin as any).rpc("smtp_config_set_password", {
      _key: key(),
      _password: input.password,
    });
    if (error) throw new Error(`Failed to encrypt SMTP password: ${error.message}`);
  }
}