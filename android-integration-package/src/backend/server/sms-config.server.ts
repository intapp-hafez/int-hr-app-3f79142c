/**
 * Loads / writes the singleton SMS Misr configuration.
 * Server-only. RLS on public.sms_config restricts reads to admin/hr, but this
 * file uses supabaseAdmin so the server function can consult the row after
 * verifying the caller via requireAdminAccess.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type SmsConfigRow = {
  environment: "1" | "2" | null;
  username: string | null;
  password: string | null;
  api_key: string | null;
  sender: string | null;
  language: "1" | "2" | "3" | null;
  enabled: boolean | null;
};

// The `sms_config` table isn't in the generated Supabase types yet, so we
// cast the client to a permissive shape locally instead of sprinkling `any`.
const admin = supabaseAdmin as unknown as {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: SmsConfigRow | null; error: { message: string } | null }>;
      };
    };
    upsert: (
      values: Record<string, unknown>,
      opts?: { onConflict?: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

export type LoadedSms = {
  environment: "1" | "2";
  username: string;
  password: string;
  api_key: string;
  sender: string;
  language: "1" | "2" | "3";
  enabled: boolean;
};

export async function loadSmsConfig(): Promise<LoadedSms | null> {
  const { data, error } = await admin
    .from("sms_config")
    .select("environment, username, password, api_key, sender, language, enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    environment: data.environment ?? "2",
    username: data.username ?? "",
    password: data.password ?? "",
    api_key: data.api_key ?? "",
    sender: data.sender ?? "",
    language: data.language ?? "1",
    enabled: !!data.enabled,
  };
}

export async function writeSmsConfig(input: {
  environment: "1" | "2";
  username: string;
  password?: string; // optional: only overwrite when a non-empty value is supplied
  api_key?: string; // optional: only overwrite when a non-empty value is supplied
  sender: string;
  language: "1" | "2" | "3";
  enabled: boolean;
  updated_by?: string;
}) {
  const patch: Record<string, unknown> = {
    id: 1,
    environment: input.environment,
    username: input.username,
    sender: input.sender,
    language: input.language,
    enabled: input.enabled,
    updated_by: input.updated_by ?? null,
    updated_at: new Date().toISOString(),
  };
  if (typeof input.password === "string" && input.password.length > 0) {
    patch.password = input.password;
  }
  if (typeof input.api_key === "string" && input.api_key.length > 0) {
    patch.api_key = input.api_key;
  }
  const { error } = await admin.from("sms_config").upsert(patch, { onConflict: "id" });
  if (error) throw new Error(error.message);
}