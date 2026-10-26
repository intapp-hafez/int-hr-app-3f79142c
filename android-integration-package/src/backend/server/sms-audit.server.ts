/**
 * Append-only audit log for SMS send attempts. Writes bypass RLS via the
 * service-role client but the server function that calls into here is
 * already gated by requireAdminAccess.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SmsAuditRow = {
  id: string;
  created_at: string;
  sent_by: string | null;
  mobile: string;
  message: string;
  kind: string;
  ok: boolean;
  provider_code: string | null;
  sms_id: string | null;
  cost: string | null;
  error: string | null;
};

export async function logSmsAudit(input: {
  sent_by?: string | null;
  mobile: string;
  message: string;
  kind?: "test" | "otp" | "notification" | "welcome" | "other";
  ok: boolean;
  provider_code?: string | null;
  sms_id?: string | null;
  cost?: string | null;
  error?: string | null;
}) {
  try {
    const { error } = await (supabaseAdmin as any).from("sms_audit").insert({
      sent_by: input.sent_by ?? null,
      mobile: input.mobile,
      message: input.message,
      kind: input.kind ?? "test",
      ok: input.ok,
      provider_code: input.provider_code ?? null,
      sms_id: input.sms_id ?? null,
      cost: input.cost ?? null,
      error: input.error ?? null,
    });
    if (error) console.warn("sms_audit insert failed", error.message);
  } catch (e: any) {
    console.warn("sms_audit insert threw", e?.message);
  }
}

export async function loadLastSmsAudit(): Promise<SmsAuditRow | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from("sms_audit")
    .select("id, created_at, sent_by, mobile, message, kind, ok, provider_code, sms_id, cost, error")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Table may not exist yet if the migration has not been run.
    console.warn("sms_audit read failed", error.message);
    return null;
  }
  return (data as SmsAuditRow) ?? null;
}

export async function loadRecentSmsAudit(opts: { kind?: string; limit?: number } = {}): Promise<SmsAuditRow[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  let q = (supabaseAdmin as any)
    .from("sms_audit")
    .select("id, created_at, sent_by, mobile, message, kind, ok, provider_code, sms_id, cost, error")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data, error } = await q;
  if (error) {
    console.warn("sms_audit list failed", error.message);
    return [];
  }
  return (data as SmsAuditRow[]) ?? [];
}

/**
 * Server-side rate limit for OTP sends. Enforces two rules per mobile number:
 *   - Cooldown: no more than 1 OTP per `cooldownSec` seconds.
 *   - Cap: no more than `maxPerHour` OTPs in the last 60 minutes.
 * Returns { allowed: true } or { allowed: false, retryAfter, reason }.
 */
export async function checkOtpRateLimit(
  mobile: string,
  opts: { cooldownSec?: number; maxPerHour?: number } = {},
): Promise<{ allowed: true } | { allowed: false; retryAfter: number; reason: string }> {
  const cooldownSec = opts.cooldownSec ?? 60;
  const maxPerHour = opts.maxPerHour ?? 5;
  const sinceHour = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data, error } = await (supabaseAdmin as any)
    .from("sms_audit")
    .select("created_at")
    .eq("kind", "otp")
    .eq("mobile", mobile)
    .gte("created_at", sinceHour)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    // If the audit table is unavailable we fail open so OTPs still work.
    console.warn("checkOtpRateLimit read failed", error.message);
    return { allowed: true };
  }
  const rows = (data ?? []) as { created_at: string }[];
  if (rows.length >= maxPerHour) {
    const oldest = new Date(rows[rows.length - 1].created_at).getTime();
    const retry = Math.max(1, Math.ceil((oldest + 60 * 60_000 - Date.now()) / 1000));
    return { allowed: false, retryAfter: retry, reason: `Too many OTP requests. Try again in ${Math.ceil(retry / 60)} min.` };
  }
  if (rows.length > 0) {
    const last = new Date(rows[0].created_at).getTime();
    const elapsed = Math.floor((Date.now() - last) / 1000);
    if (elapsed < cooldownSec) {
      const retry = cooldownSec - elapsed;
      return { allowed: false, retryAfter: retry, reason: `Please wait ${retry}s before requesting another OTP.` };
    }
  }
  return { allowed: true };
}

/**
 * Load the latest welcome SMS audit entry for each mobile number.
 */
export async function loadWelcomeSmsAudits(): Promise<Record<string, SmsAuditRow>> {
  const { data, error } = await (supabaseAdmin as any)
    .from("sms_audit")
    .select("id, created_at, sent_by, mobile, message, kind, ok, provider_code, sms_id, cost, error")
    .eq("kind", "welcome")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("loadWelcomeSmsAudits read failed", error.message);
    return {};
  }

  const map: Record<string, SmsAuditRow> = {};
  for (const row of (data as SmsAuditRow[] ?? [])) {
    // Keeps the latest row per mobile number
    if (!map[row.mobile]) {
      map[row.mobile] = row;
    }
  }
  return map;
}