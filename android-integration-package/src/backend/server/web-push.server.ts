// Web Push sender.
// In the browser (pure static SPA), web-push cannot run client-side because
// it requires Node.js network/crypto primitives. It falls back gracefully.
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/vapid";

const isBrowser =
  typeof window !== "undefined" ||
  typeof (globalThis as any).process === "undefined" ||
  !(globalThis as any).process?.env;

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

let configured = false;
let webpushModule: any = null;

async function getWebPush() {
  if (isBrowser) return null;
  if (!webpushModule) {
    try {
      const wp = await import("web-push");
      webpushModule = wp.default || wp;
    } catch {
      return null;
    }
  }
  return webpushModule;
}

export async function sendPushTo(
  sub: PushSub,
  payload: PushPayload
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (isBrowser) {
    return { ok: false, error: "Push sending not supported in client browser" };
  }

  const wp = await getWebPush();
  if (!wp || typeof wp.sendNotification !== "function") {
    return { ok: false, error: "web-push module not available" };
  }

  const priv =
    (typeof process !== "undefined" && process.env?.VAPID_PRIVATE_KEY) ||
    "D86rpym_H3JhHtp-WT6dx3T56_0L0tehQGklXLR6UzU";
  if (!priv) return { ok: false, error: "VAPID private key missing" };

  try {
    if (!configured && typeof wp.setVapidDetails === "function") {
      wp.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, priv);
      configured = true;
    }

    const res = await wp.sendNotification(
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