import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint called by Supabase pg_cron every minute.
 * Authenticates with the Supabase anon key (apikey header) per the platform pattern.
 * Always returns 200 with a JSON summary so pg_cron logs stay clean; failure detail
 * lives in export_runs.error.
 */
export const Route = createFileRoute("/api/public/cron/run-schedules")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "content-type": "application/json" },
          });
        }
        try {
          const { runDueSchedules } = await import("@/backend/server/scheduler.server");
          const summaries = await runDueSchedules(new Date());
          return new Response(JSON.stringify({ ok: true, count: summaries.length, summaries }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
      },
      GET: async () => {
        return new Response(JSON.stringify({ ok: true, hint: "POST with apikey header to run" }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});