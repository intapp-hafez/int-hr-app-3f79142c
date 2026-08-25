/**
 * Locale- and timezone-independent date helpers.
 * Canonical storage/transport format is ISO `yyyy-mm-dd`.
 * Canonical display/input format is `dd-mm-yyyy`.
 * These helpers never construct a `Date` for plain calendar dates,
 * so results are identical in every device locale and time zone.
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= lengths[m - 1];
}

/** Format an ISO date (yyyy-mm-dd, or ISO datetime) as dd-mm-yyyy. Returns "—" when empty. */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  const iso = String(dateString).slice(0, 10);
  const parts = iso.split("-");
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return String(dateString);
}

/** ISO (yyyy-mm-dd) -> dd-mm-yyyy. Returns "" when the input is empty/invalid. */
export function isoToDmy(value?: string | null): string {
  if (!value) return "";
  const m = ISO_RE.exec(String(value).slice(0, 10));
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** dd-mm-yyyy -> ISO (yyyy-mm-dd). Returns "" when incomplete or invalid. */
export function dmyToIso(value?: string | null): string {
  if (!value) return "";
  const m = DMY_RE.exec(String(value).trim());
  if (!m) return "";
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!isValidYmd(y, mo, d)) return "";
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** True when the string is a well-formed ISO calendar date. */
export function isIsoDate(value?: string | null): boolean {
  if (!value) return false;
  const m = ISO_RE.exec(String(value));
  return !!m && isValidYmd(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Today's calendar date in the device's local time zone, as ISO yyyy-mm-dd. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Convert a Date (local calendar day) to ISO yyyy-mm-dd without UTC drift. */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Parse an ISO calendar date into a local-noon Date (safe against DST/UTC shifts). */
export function parseISODate(value?: string | null): Date | null {
  if (!isIsoDate(value?.slice(0, 10))) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Format a dd-mm-yyyy range, e.g. "01-02-2026 → 05-02-2026". */
export function formatDateRange(from?: string | null, to?: string | null): string {
  if (!from && !to) return "—";
  if (from && to && from === to) return formatDate(from);
  return `${formatDate(from)} → ${formatDate(to)}`;
}

/** Weekday index (0 = Sunday) for an ISO date, using local-noon parsing (no DST/UTC off-by-one). */
export function isoWeekday(value: string): number {
  const d = parseISODate(value);
  return d ? d.getDay() : NaN;
}

/** Whole days between two ISO dates (b - a), computed at local noon so DST never shifts the result. */
export function daysBetweenIso(a: string, b: string): number {
  const da = parseISODate(a);
  const db = parseISODate(b);
  if (!da || !db) return NaN;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/**
 * Validate a date range. Returns a human message in dd-mm-yyyy, or null when valid.
 * Empty values are allowed unless `required` is set.
 */
export function validateDateRange(
  from?: string | null,
  to?: string | null,
  opts: { required?: boolean; maxDays?: number; label?: { from: string; to: string } } = {},
): string | null {
  const L = opts.label ?? { from: "From", to: "To" };
  const hasFrom = !!from;
  const hasTo = !!to;
  if (opts.required && (!hasFrom || !hasTo)) return `${L.from} and ${L.to} dates are required (dd-mm-yyyy).`;
  if (hasFrom && !isIsoDate(from!.slice(0, 10))) return `${L.from} date is not a valid date (dd-mm-yyyy).`;
  if (hasTo && !isIsoDate(to!.slice(0, 10))) return `${L.to} date is not a valid date (dd-mm-yyyy).`;
  if (hasFrom && hasTo) {
    const diff = daysBetweenIso(from!, to!);
    if (diff < 0) return `${L.to} date (${formatDate(to)}) must be on or after ${L.from.toLowerCase()} date (${formatDate(from)}).`;
    if (opts.maxDays && diff + 1 > opts.maxDays)
      return `Range ${formatDateRange(from, to)} is longer than ${opts.maxDays} days.`;
  }
  return null;
}
