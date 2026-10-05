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
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2150) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= lengths[m - 1];
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
  يناير: 1, فبراير: 2, مارس: 3, ابريل: 4, أبريل: 4, مايو: 5, يونيو: 6,
  يوليو: 7, اغسطس: 8, أغسطس: 8, سبتمبر: 9, اكتوبر: 10, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

/**
 * Normalizes any Excel date input (Date object, Excel serial number, or date string
 * like DD/MM/YYYY, YYYY-MM-DD, D/M/YY, Arabic digits, etc.) into a strict ISO "YYYY-MM-DD" string.
 * Returns "" if input is empty, null, undefined, or unparseable.
 */
export function normalizeExcelDate(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Convert Arabic-Indic digits ٠-٩ to 0-9 and remove invisible directional markers
  let s = String(val).replace(/[\u200e\u200f\u202a-\u202e\u00a0]/g, "").trim();
  s = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!s) return "";

  // If numeric or string containing solely a number in range 1000-90000 (Excel serial date)
  if (typeof val === "number" || /^\d{4,5}(\.\d+)?$/.test(s)) {
    const num = Number(s);
    if (!isNaN(num) && num >= 1000 && num <= 100000) {
      // Excel epoch starts at 1899-12-30 (due to Lotus 1-2-3 bug)
      const utcDays = Math.floor(num - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, "0");
        const d = String(date.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
  }

  // ISO with T (e.g. 2025-01-15T00:00:00.000Z) or already YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return isValidYmd(y, m, d) ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : "";
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const y = Number(ymdMatch[1]);
    const m = Number(ymdMatch[2]);
    const d = Number(ymdMatch[3]);
    return isValidYmd(y, m, d) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";
  }

  // D/M/YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const p1 = Number(dmyMatch[1]);
    const p2 = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    let day = p1;
    let month = p2;
    if (p1 <= 12 && p2 > 12) {
      month = p1;
      day = p2;
    }
    return isValidYmd(y, month, day) ? `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
  }

  // D/M/YY or DD/MM/YY
  const dmy2Match = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmy2Match) {
    const p1 = Number(dmy2Match[1]);
    const p2 = Number(dmy2Match[2]);
    let yy = Number(dmy2Match[3]);
    const y = yy < 50 ? 2000 + yy : 1900 + yy;
    let day = p1;
    let month = p2;
    if (p1 <= 12 && p2 > 12) {
      month = p1;
      day = p2;
    }
    return isValidYmd(y, month, day) ? `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
  }

  // Handle named month formats like "21-Aug-31", "1-Aug-26", "August , 2024", "May 2024"
  const cleanNamed = s.replace(/,/g, " ").replace(/[\s\-_]+/g, " ").trim().toLowerCase();
  const dmyNamed = cleanNamed.match(/^(\d{1,2})\s+([a-z\u0621-\u064a]+)\s+(\d{2,4})$/);
  if (dmyNamed) {
    const day = Number(dmyNamed[1]);
    const mStr = dmyNamed[2];
    let y = Number(dmyNamed[3]);
    if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;
    const month = MONTH_NAME_MAP[mStr] || MONTH_NAME_MAP[mStr.slice(0, 3)];
    if (month && isValidYmd(y, month, day)) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const mdyNamed = cleanNamed.match(/^([a-z\u0621-\u064a]+)\s+(\d{1,2})\s+(\d{2,4})$/);
  if (mdyNamed) {
    const mStr = mdyNamed[1];
    const day = Number(mdyNamed[2]);
    let y = Number(mdyNamed[3]);
    if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;
    const month = MONTH_NAME_MAP[mStr] || MONTH_NAME_MAP[mStr.slice(0, 3)];
    if (month && isValidYmd(y, month, day)) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const myNamed = cleanNamed.match(/^([a-z\u0621-\u064a]+)\s+(\d{4})$/);
  if (myNamed) {
    const mStr = myNamed[1];
    const y = Number(myNamed[2]);
    const month = MONTH_NAME_MAP[mStr] || MONTH_NAME_MAP[mStr.slice(0, 3)];
    if (month && isValidYmd(y, month, 1)) {
      return `${y}-${String(month).padStart(2, "0")}-01`;
    }
  }

  // Fallback: Date.parse
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    if (isValidYmd(y, m, d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return "";
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
