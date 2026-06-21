// VAPID public key (safe to expose to the browser by design).
// Pair with VAPID_PRIVATE_KEY in server env. Rotate via add_secret if compromised.
export const VAPID_PUBLIC_KEY =
  "BNlW7NfX-AA2fTWR-9u0uqAj3Q4GgLEnv6mkZOfPB_bRKzkcut06GKxrn2jaIESSXrBYPX3e3ln65FwnGlFrzkE";

export const VAPID_SUBJECT = "mailto:int.app2026@gmail.com";

/** Convert a base64url VAPID public key into the Uint8Array PushManager expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}