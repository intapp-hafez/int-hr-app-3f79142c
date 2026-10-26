import { z } from "zod";
import { formatDate, isIsoDate, daysBetweenIso } from "@/lib/date-format";

/**
 * Shared server-side date-range validation.
 *
 * Transport format is ISO `yyyy-mm-dd`; every user-facing message is rendered
 * in `dd-mm-yyyy` so server errors match the client toasts/inline errors.
 */

export type DateRangeOptions = {
  /** Field labels used in messages, e.g. { from: "From", to: "To" }. */
  label?: { from: string; to: string };
  /** Maximum inclusive length of the range in days. */
  maxDays?: number;
  /** When true, both dates may be omitted (but if one is given, both are required). */
  optional?: boolean;
};

const DEFAULT_LABEL = { from: "From", to: "To" };

/** A single ISO calendar date, validated for real calendar correctness. */
export function isoDateSchema(label = "Date") {
  return z
    .string()
    .trim()
    .refine((v) => isIsoDate(v), {
      message: `${label} must be a valid date (dd-mm-yyyy).`,
    });
}

/** Validate a from/to pair, returning a human message (dd-mm-yyyy) or null. */
export function checkDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
  opts: DateRangeOptions = {},
): string | null {
  const L = opts.label ?? DEFAULT_LABEL;
  const hasFrom = !!from;
  const hasTo = !!to;

  if (!hasFrom && !hasTo) {
    return opts.optional ? null : `${L.from} and ${L.to} dates are required (dd-mm-yyyy).`;
  }
  if (!hasFrom) return `${L.from} date is required (dd-mm-yyyy).`;
  if (!hasTo) return `${L.to} date is required (dd-mm-yyyy).`;
  if (!isIsoDate(from!)) return `${L.from} date is not a valid date (dd-mm-yyyy).`;
  if (!isIsoDate(to!)) return `${L.to} date is not a valid date (dd-mm-yyyy).`;

  const diff = daysBetweenIso(from!, to!);
  if (diff < 0) {
    return `${L.to} date (${formatDate(to)}) must be on or after ${L.from.toLowerCase()} date (${formatDate(from)}).`;
  }
  if (opts.maxDays && diff + 1 > opts.maxDays) {
    return `Range ${formatDate(from)} → ${formatDate(to)} is longer than ${opts.maxDays} days.`;
  }
  return null;
}

/** Attach the range refinement to any object schema that has `from`/`to`-like fields. */
export function withDateRange<T extends z.ZodTypeAny>(
  schema: T,
  pick: (value: z.infer<T>) => { from?: string | null; to?: string | null },
  opts: DateRangeOptions = {},
) {
  return schema.superRefine((value, ctx) => {
    const { from, to } = pick(value as z.infer<T>);
    const message = checkDateRange(from, to, opts);
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["to"] });
    }
  });
}

/** Canonical `{ from, to }` range schema used by list/report filters. */
export function dateRangeSchema(opts: DateRangeOptions = {}) {
  const L = opts.label ?? DEFAULT_LABEL;
  const base = z.object({
    from: opts.optional
      ? isoDateSchema(L.from).optional().nullable()
      : isoDateSchema(L.from),
    to: opts.optional ? isoDateSchema(L.to).optional().nullable() : isoDateSchema(L.to),
  });
  return withDateRange(base, (v) => ({ from: v.from, to: v.to }), opts);
}

/**
 * Range schema for records stored as `start_date` / `end_date`
 * (leaves, holidays overlap filters).
 */
export function startEndRangeSchema(opts: DateRangeOptions = {}) {
  const L = opts.label ?? { from: "Start", to: "End" };
  const merged = { ...opts, label: L };
  const base = z.object({
    start_date: isoDateSchema(L.from),
    end_date: isoDateSchema(L.to),
  });
  return withDateRange(base, (v) => ({ from: v.start_date, to: v.end_date }), merged);
}
