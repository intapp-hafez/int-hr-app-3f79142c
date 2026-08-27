import { z } from "zod";

/**
 * Unified validation error payload.
 *
 * Server functions serialize errors as `Error.message` strings, so field-level
 * detail is encoded as a JSON envelope that the client can decode with
 * `parseValidationError` (see `src/lib/validation-error.ts`). Messages are
 * already rendered in dd-mm-yyyy by the date-range helpers.
 */
export const VALIDATION_ERROR_TAG = "__validation_error__";

export type ValidationErrorPayload = {
  [VALIDATION_ERROR_TAG]: true;
  /** First/summary message, safe to use directly in a toast. */
  message: string;
  /** Field path (dot-joined) → messages. */
  fieldErrors: Record<string, string[]>;
  /** Messages with no field path. */
  formErrors: string[];
};

export type ParseOptions = {
  /**
   * Map schema field paths to the client's field names, e.g.
   * `{ start_date: "from", end_date: "to" }`.
   */
  fieldAliases?: Record<string, string>;
  /** Fallback summary message when the issue list is empty. */
  fallbackMessage?: string;
};

export function buildValidationPayload(
  error: z.ZodError,
  opts: ParseOptions = {},
): ValidationErrorPayload {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];

  for (const issue of error.issues) {
    const rawPath = issue.path.filter((p) => typeof p !== "number").join(".");
    const path = (opts.fieldAliases?.[rawPath] ?? rawPath) || "";
    if (!path) formErrors.push(issue.message);
    else (fieldErrors[path] ??= []).push(issue.message);
  }

  const message =
    formErrors[0] ??
    Object.values(fieldErrors)[0]?.[0] ??
    opts.fallbackMessage ??
    "Invalid input.";

  return { [VALIDATION_ERROR_TAG]: true, message, fieldErrors, formErrors };
}

/** Parse with a schema, throwing the unified validation payload on failure. */
export function parseInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
  opts: ParseOptions = {},
): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new Error(JSON.stringify(buildValidationPayload(result.error, opts)));
}
