import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitAction = "check_in" | "check_out";

export type RateLimitResult =
  | { limited: false }
  | { limited: true; attempts: number; max: number; windowSeconds: number; retryAfterSeconds: number };

const DEFAULTS = { enabled: true, attempts: 5, windowSeconds: 60 };

export async function loadAttendanceRateLimitConfig(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase
    .from("security_settings")
    .select(
      "attendance_rate_limit_enabled, attendance_rate_limit_attempts, attendance_rate_limit_window_seconds",
    )
    .eq("id", 1)
    .maybeSingle();

  // Columns not migrated yet (or no row): fall back to defaults.
  if (error || !data) return DEFAULTS;
  const row = data as Record<string, unknown>;
  return {
    enabled: row["attendance_rate_limit_enabled"] !== false,
    attempts: Number(row["attendance_rate_limit_attempts"] ?? DEFAULTS.attempts) || DEFAULTS.attempts,
    windowSeconds:
      Number(row["attendance_rate_limit_window_seconds"] ?? DEFAULTS.windowSeconds) || DEFAULTS.windowSeconds,
  };
}

/**
 * Records the attempt and reports whether the caller exceeded the admin-configured
 * threshold (N attempts per window) for this action. Fails open when the
 * attempts table is unavailable so attendance never breaks on infra errors.
 */
export async function enforceAttendanceRateLimit(
  supabase: SupabaseClient<any>,
  userId: string,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  const cfg = await loadAttendanceRateLimitConfig(supabase);
  if (!cfg.enabled) return { limited: false };

  const since = new Date(Date.now() - cfg.windowSeconds * 1000).toISOString();
  const { data: recent, error } = await supabase
    .from("attendance_check_attempts")
    .select("created_at")
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) return { limited: false };

  const attempts = (recent ?? []).length;
  const limited = attempts >= cfg.attempts;

  await supabase
    .from("attendance_check_attempts")
    .insert({ user_id: userId, action, allowed: !limited } as never);

  if (!limited) return { limited: false };

  const oldest = recent?.[0]?.created_at as string | undefined;
  const retryAfterSeconds = oldest
    ? Math.max(1, Math.ceil((new Date(oldest).getTime() + cfg.windowSeconds * 1000 - Date.now()) / 1000))
    : cfg.windowSeconds;

  return { limited: true, attempts, max: cfg.attempts, windowSeconds: cfg.windowSeconds, retryAfterSeconds };
}
