// Server-only Web Push sender using the `web-push` npm library + VAPID.
// Falls back gracefully when VAPID_PRIVATE_KEY is missing.
import webpush from "web-push";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/vapid";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const priv = process.env.VAPID_PRIVATE_KEY || "D86rpym_H3JhHtp-WT6dx3T56_0L0tehQGklXLR6UzU";
  if (!priv) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, priv);
    configured = true;
    return true;
  } catch {
    return false;
  }
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushSub = {
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

export async function sendPushTo(sub: PushSub, payload: PushPayload): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!ensureConfigured()) return { ok: false, error: "VAPID not configured" };
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } },
      JSON.stringify(payload),
      { TTL: 60 },
    );
    return { ok: true, status: res.statusCode };
  } catch (e: any) {
    const status = e?.statusCode as number | undefined;
    return { ok: false, status, error: e?.body || e?.message || "push send failed" };
  }
}