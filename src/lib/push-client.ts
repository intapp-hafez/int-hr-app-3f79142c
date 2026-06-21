import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "./vapid";

export type PushSupport = "unsupported" | "denied" | "default" | "granted";

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushSupport;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw-push.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
}

function b64encode(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (getPushSupport() === "unsupported") return { ok: false, reason: "Browser does not support push" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permission denied" };
  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });
  }
  const json = sub.toJSON();
  const endpoint = json.endpoint!;
  const p256dh = json.keys?.p256dh ?? b64encode((sub.getKey && sub.getKey("p256dh")) || null);
  const authSecret = json.keys?.auth ?? b64encode((sub.getKey && sub.getKey("auth")) || null);
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id) return { ok: false, reason: "Not signed in" };
  const sb = supabase as any;
  const { error } = await sb
    .from("push_subscriptions")
    .upsert(
      { user_id, endpoint, p256dh, auth_secret: authSecret, user_agent: navigator.userAgent },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await (supabase as any).from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (getPushSupport() === "unsupported") return false;
  if (Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}