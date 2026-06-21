import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { z } from "zod";
import { ExportScheduleSchema } from "../schemas";

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("export_schedules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => ExportScheduleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = { ...data, owner_id: userId };
    if (data.id) {
      const { error } = await supabase.from("export_schedules").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("export_schedules").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("export_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listScheduleRuns = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("export_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const triggerScheduleNow = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .handler(async () => {
    const { runDueSchedules } = await import("../server/scheduler.server");
    const summaries = await runDueSchedules(new Date());
    return { summaries };
  });