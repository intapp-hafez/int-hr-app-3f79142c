import { createServerFn } from "@tanstack/react-start";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/vapid";

export const getVapidStatus = createServerFn({ method: "GET" }).handler(async () => {
  const priv = process.env.VAPID_PRIVATE_KEY;
  return {
    publicKey: VAPID_PUBLIC_KEY,
    subject: VAPID_SUBJECT,
    configured: Boolean(priv),
    usingDevFallback: !priv,
  };
});