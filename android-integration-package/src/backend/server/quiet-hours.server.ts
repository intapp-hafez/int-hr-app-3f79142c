function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

/**
 * Returns true if "now" falls within the user's quiet-hours window.
 * Window may wrap midnight (e.g. 22:00 to 07:00).
 */
export function isQuietNow(
  start: string | null | undefined,
  end: string | null | undefined,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (!start || !end) return false;
  let hhmm: string;
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    hhmm = fmt.format(now);
  } catch {
    hhmm = now.toISOString().slice(11, 16);
  }
  const cur = toMinutes(hhmm);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e;
}