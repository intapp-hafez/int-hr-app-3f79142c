import { toast } from "sonner";

/**
 * Client-side decoder for the unified server validation payload produced by
 * `src/backend/schemas/validation-error.ts`. Keeps dd-mm-yyyy server messages
 * mapped to the same field names the forms/filters use.
 */
export const VALIDATION_ERROR_TAG = "__validation_error__";

export type ParsedValidationError = {
  message: string;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
  /** True when the error came from the unified validation envelope. */
  structured: boolean;
};

function rawMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

export function parseValidationError(err: unknown, fallback = "Something went wrong."): ParsedValidationError {
  const raw = rawMessage(err);
  const start = raw.indexOf("{");
  if (start >= 0 && raw.includes(VALIDATION_ERROR_TAG)) {
    try {
      const parsed = JSON.parse(raw.slice(start)) as Record<string, unknown>;
      if (parsed[VALIDATION_ERROR_TAG]) {
        return {
          message: typeof parsed.message === "string" ? parsed.message : fallback,
          fieldErrors: (parsed.fieldErrors as Record<string, string[]>) ?? {},
          formErrors: (parsed.formErrors as string[]) ?? [],
          structured: true,
        };
      }
    } catch {
      /* fall through to plain message */
    }
  }
  return { message: raw || fallback, fieldErrors: {}, formErrors: [], structured: false };
}

/** First message for a field (supports alias lookup across several names). */
export function fieldError(parsed: ParsedValidationError, ...names: string[]): string | null {
  for (const n of names) {
    const list = parsed.fieldErrors[n];
    if (list?.length) return list[0];
  }
  return null;
}

/** Show the unified message as a toast and return the parsed payload. */
export function toastValidationError(err: unknown, fallback = "Something went wrong."): ParsedValidationError {
  const parsed = parseValidationError(err, fallback);
  toast.error(parsed.message);
  return parsed;
}
