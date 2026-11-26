import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SYSTEM_MIDNIGHT_CHECKOUT_MARKER = "System Midnight Checkout";

type LocalClock = {
  dateStr: string; // YYYY-MM-DD in target timezone
  hhmm: string;    // HH:MM in target timezone
  hour: number;
  minute: number;
};

/**
 * Returns local calendar date (YYYY-MM-DD) and 24h time in the given IANA timezone.
 */
export function getLocalClockInTz(tz: string, now: Date = new Date()): LocalClock {
  const safeTz = tz || "Africa/Cairo";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { dateStr, hhmm, hour, minute };
}

/**
 * Given a local calendar date YYYY-MM-DD, returns the previous calendar day YYYY-MM-DD.
 */
function previousDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Converts a local wall-clock time (YYYY-MM-DD 23:59:59) in `tz` to a UTC ISO string.
 */
function localEndOfDayIso(dateStr: string, tz: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Start with a UTC guess and adjust by the timezone's offset at that instant
  const guess = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  const inTz = new Date(guess.toLocaleString("en-US", { timeZone: tz || "Africa/Cairo" }));
  const diffMs = guess.getTime() - inTz.getTime();
  return new Date(guess.getTime() + diffMs).toISOString();
}

export type MidnightCheckoutResult = {
  ran: boolean;
  reason?: string;
  targetDate?: string;
  timezone?: string;
  checkedOutCount: number;
};

/**
 * Checks whether "Auto checkout at midnight" is enabled, whether local time
 * has just crossed midnight (00:00–00:15), and idempotently checks out all
 * employees who checked in on the day that just ended without checking out.
 */
export async function runAutoCheckoutAtMidnight(now: Date = new Date()): Promise<MidnightCheckoutResult> {
  // 1. Load toggle setting
  const { data: settings, error: setErr } = await (supabaseAdmin as any)
    .from("attendance_automation_settings")
    .select("auto_checkout_at_midnight, timezone")
    .eq("id", 1)
    .maybeSingle();

  if (setErr || !settings || settings.auto_checkout_at_midnight !== true) {
    return { ran: false, reason: "disabled", checkedOutCount: 0 };
  }

  const tz = settings.timezone || "Africa/Cairo";
  const clock = getLocalClockInTz(tz, now);

  // Only trigger in the midnight window (00:00 through 00:15 local time)
  if (clock.hour !== 0 || clock.minute > 15) {
    return { ran: false, reason: "outside_midnight_window", timezone: tz, checkedOutCount: 0 };
  }

  // At 00:00 on the new day, close open check-ins from the day that just ended
  const targetDate = previousDateStr(clock.dateStr);

  // 2. Acquire database idempotency lock for `targetDate` (prevents duplicates)
  const { error: lockErr } = await (supabaseAdmin as any)
    .from("auto_checkout_runs")
    .insert({ run_date: targetDate, timezone: tz, checked_out_count: 0, employee_ids: [] });

  if (lockErr) {
    // 23505 = unique_violation -> already ran for this date
    return { ran: false, reason: "already_ran_for_date", targetDate, timezone: tz, checkedOutCount: 0 };
  }

  // 3. Find all attendance rows for `targetDate` with check-in and NO check-out
  const { data: openRows, error: fetchErr } = await supabaseAdmin
    .from("attendance")
    .select("id, employee_id, note")
    .eq("date", targetDate)
    .not("in_time", "is", null)
    .is("out_time", null);

  if (fetchErr) {
    // Release lock on transient DB read error so next minute's cron can retry
    await (supabaseAdmin as any).from("auto_checkout_runs").delete().eq("run_date", targetDate);
    throw new Error(`auto-checkout fetch failed: ${fetchErr.message}`);
  }

  const rows = openRows ?? [];
  const checkoutIso = localEndOfDayIso(targetDate, tz);
  const checkedOutEmployeeIds: string[] = [];

  for (const row of rows) {
    const nextNote = row.note?.trim()
      ? `${row.note.trim()} | ${SYSTEM_MIDNIGHT_CHECKOUT_MARKER}`
      : SYSTEM_MIDNIGHT_CHECKOUT_MARKER;

    const { error: updErr } = await supabaseAdmin
      .from("attendance")
      .update({
        out_time: checkoutIso,
        note: nextNote,
      })
      .eq("id", row.id)
      .is("out_time", null);

    if (!updErr) {
      checkedOutEmployeeIds.push(row.employee_id);
    }
  }

  // 4. Update run record & automation settings summary
  await Promise.all([
    (supabaseAdmin as any)
      .from("auto_checkout_runs")
      .update({
        checked_out_count: checkedOutEmployeeIds.length,
        employee_ids: checkedOutEmployeeIds,
      })
      .eq("run_date", targetDate),
    (supabaseAdmin as any)
      .from("attendance_automation_settings")
      .update({
        last_run_date: targetDate,
        last_run_at: now.toISOString(),
        last_run_count: checkedOutEmployeeIds.length,
      })
      .eq("id", 1),
    supabaseAdmin.from("security_audit_events").insert({
      kind: "system_midnight_checkout",
      severity: "info",
      path: "/api/public/cron/run-schedules",
      detail: {
        marker: SYSTEM_MIDNIGHT_CHECKOUT_MARKER,
        run_date: targetDate,
        timezone: tz,
        checkout_time: checkoutIso,
        checked_out_count: checkedOutEmployeeIds.length,
        employee_ids: checkedOutEmployeeIds,
      },
    } as never),
  ]);

  return {
    ran: true,
    targetDate,
    timezone: tz,
    checkedOutCount: checkedOutEmployeeIds.length,
  };
}
