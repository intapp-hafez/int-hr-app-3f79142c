import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

const Input = z.object({
  alerts: z
    .array(
      z.object({
        alertId: z.string(),
        category: z.enum(["pending_leave", "late", "absent", "checkin", "checkout"]),
        title: z.string(),
        body: z.string(),
        url: z.string().optional(),
      }),
    )
    .max(50),
});

/**
 * Fan an admin alert (or batch) out to all admin recipients respecting
 * per-user category prefs and channels (in-app, email, push).
 *
 * Called from the admin notifications bell whenever a realtime event arrives,
 * so backend delivery happens without any DB triggers / pg_net setup.
 * Deduplicates by (user_id, channel, alert_id) so multiple admins triggering
 * the same event don't produce duplicate sends.
 */
export const dispatchAdminAlerts = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }) => {
    const { dispatchAlert } = await import("@/backend/server/alert-dispatch.server");
    const results: Array<{ alertId: string; recipients: number; sent: number }> = [];
    for (const a of data.alerts) {
      try {
        const r = await dispatchAlert(a);
        results.push({ alertId: a.alertId, ...r });
      } catch (e: any) {
        results.push({ alertId: a.alertId, recipients: 0, sent: 0 });
        console.error("dispatchAlert failed", a.alertId, e?.message);
      }
    }
    return { results };
  });