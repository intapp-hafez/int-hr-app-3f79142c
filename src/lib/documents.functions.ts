import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Allowed MIME types and magic-byte signatures (base64-prefix) for HR documents.
const ALLOWED = {
  "application/pdf": ["JVBER"], // %PDF
  "image/png": ["iVBORw0K"],
  "image/jpeg": ["/9j/"],
  "image/jpg": ["/9j/"],
} as const;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const DocSchema = z.object({
  name: z.string().min(1).max(255).regex(/^[\w.\- ()]+$/, "Invalid filename"),
  type: z.string().min(1).max(64),
  size: z.number().int().nonnegative().max(MAX_BYTES, "File exceeds 2 MB"),
  dataUrl: z.string().min(16).max(MAX_BYTES * 2),
  kind: z.enum([
    "docIdFront",
    "docIdBack",
    "docContract",
    "docCriminalFront",
    "docMilitaryFront",
    "docMilitaryBack",
    "personalPhone",
  ]).optional(),
});

function decodeBase64Length(b64: string): number {
  const clean = b64.replace(/=+$/g, "");
  return Math.floor((clean.length * 3) / 4);
}

/**
 * Server-side validation for HR document uploads.
 * - Enforces 2 MB hard cap (declared size + decoded payload).
 * - Enforces MIME allowlist (PDF/PNG/JPEG only).
 * - Verifies the file's magic bytes match the declared MIME (prevents
 *   a malicious .exe disguised as image/png).
 * - Returns the validated payload for the client to persist.
 *
 * Note: in production the dataUrl would be streamed into private object
 * storage and a signed URL returned instead of the raw payload.
 */
export const validateAndStoreDocument = createServerFn({ method: "POST" })
  .inputValidator((data) => DocSchema.parse(data))
  .handler(async ({ data }) => {
    const type = data.type.toLowerCase();
    const allowed = (ALLOWED as Record<string, readonly string[]>)[type];
    if (!allowed) {
      throw new Error("invalidFileType");
    }

    const match = data.dataUrl.match(/^data:([\w./+-]+);base64,(.+)$/);
    if (!match) throw new Error("invalidFileType");
    const [, declaredMime, b64] = match;
    if (declaredMime.toLowerCase() !== type) {
      throw new Error("invalidFileType");
    }

    const decoded = decodeBase64Length(b64);
    if (decoded > MAX_BYTES) {
      throw new Error("fileTooLarge");
    }

    const signatureOk = allowed.some((sig) => b64.startsWith(sig));
    if (!signatureOk) {
      throw new Error("invalidFileType");
    }

    return {
      ok: true as const,
      name: data.name,
      type,
      size: decoded,
      dataUrl: data.dataUrl,
      storedAt: new Date().toISOString(),
    };
  });