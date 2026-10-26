import { supabase } from "@/integrations/supabase/client";

/**
 * Thin ePush (epusheg.com) client.
 *
 * This app runs as an SPA, so server functions execute in the browser. Direct
 * browser requests to api.epusheg.com are blocked by CORS. Instead we delegate
 * the call to the Supabase Edge Function `send-sms`.
 */
export type SmsAuth = {
  environment: "1" | "2";
  username: string;
  password: string;
  apiKey: string;
  sender: string;
};

export type SmsSendInput = {
  mobile: string | string[];
  message: string;
  language?: "1" | "2" | "3";
  delayUntil?: string; // YYYYMMDDHHmm
};

export type SmsSendResult = {
  ok: boolean;
  code?: string;
  smsId?: string;
  cost?: string;
  raw?: unknown;
  error?: string;
};

/** Validate the ePush credential set and return a friendly error message if incomplete. */
export function validateSmsAuth(auth: Partial<SmsAuth>): string | null {
  const missing: string[] = [];
  if (!auth.username?.trim()) missing.push("username");
  if (!auth.password?.trim()) missing.push("password");
  if (!auth.apiKey?.trim()) missing.push("api key");
  if (!auth.sender?.trim()) missing.push("from / sender");
  if (missing.length) return `SMS is not configured — missing ${missing.join(", ")}. Ask an admin to complete Settings → SMS.`;
  return null;
}

/** Normalize an Egyptian mobile to the ePush accepted formats (201… or 01…). */
export function normalizeEpushMobile(input: string): string | null {
  let m = input.trim().replace(/[\s\-()]/g, "");
  if (m.startsWith("+")) m = m.slice(1);
  if (/^201\d{9}$/.test(m)) return m;
  if (/^01\d{9}$/.test(m)) return m;
  if (/^1\d{9}$/.test(m)) return `20${m}`; // missing leading 0
  return null;
}

/** Normalize one-or-many recipients. Returns { ok, mobile, invalid } */
export function normalizeRecipients(input: string | string[]): { ok: boolean; mobile: string; invalid: string[] } {
  const list = Array.isArray(input) ? input : input.split(",");
  const good: string[] = [];
  const bad: string[] = [];
  for (const raw of list) {
    const t = raw.trim();
    if (!t) continue;
    const n = normalizeEpushMobile(t);
    if (n) good.push(n); else bad.push(t);
  }
  return { ok: good.length > 0 && bad.length === 0, mobile: good.join(","), invalid: bad };
}

export async function sendSmsEpush(auth: SmsAuth, msg: SmsSendInput): Promise<SmsSendResult> {
  const authErr = validateSmsAuth(auth);
  if (authErr) return { ok: false, error: authErr };
  const rec = normalizeRecipients(msg.mobile);
  if (rec.invalid.length) {
    return { ok: false, error: `Invalid mobile number(s): ${rec.invalid.join(", ")}. Use 201XXXXXXXXX or 01XXXXXXXXX.` };
  }
  if (!rec.mobile) return { ok: false, error: "No recipient specified" };
  if (!msg.message?.trim()) return { ok: false, error: "Message body is empty" };

  try {
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: {
        auth,
        msg: {
          mobile: rec.mobile,
          message: msg.message,
        },
      },
    });

    if (error) {
      let msg = error.message ?? "SMS send failed";
      try {
        if ("context" in error && (error as any).context) {
          const res = (error as any).context as Response;
          const body = await res.json();
          if (body?.error) msg = body.error;
        }
      } catch {}
      return { ok: false, error: msg };
    }

    const res = (data ?? {}) as SmsSendResult;
    return {
      ok: Boolean(res.ok),
      code: res.code,
      smsId: res.smsId,
      cost: res.cost,
      raw: res.raw,
      error: res.error,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}

// Backwards-compatible alias (old code path may still import this name).
export const sendSmsMisr = sendSmsEpush;