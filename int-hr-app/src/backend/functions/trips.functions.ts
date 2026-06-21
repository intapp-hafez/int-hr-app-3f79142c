import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TripCreateSchema, TransitionSchema } from "../schemas";

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("trips")
      .select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => TripCreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase.from("trips").insert({
      destination: data.destination,
      address: data.address ?? null,
      trip_date: data.trip_date,
      trip_time: data.trip_time ?? null,
      purpose: data.purpose ?? null,
      notes: data.notes ?? null,
      assignee: data.assignee,
      created_by: context.userId,
      status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const transitionTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => TransitionSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const patch: { status: typeof data.status; started_at?: string; completed_at?: string } = { status: data.status };
    if (data.status === "in_progress") patch.started_at = now;
    if (data.status === "done") patch.completed_at = now;
    const { data: row, error } = await supabase.from("trips").update(patch).eq("id", data.id)
      .select("id, destination").single();
    if (error) throw new Error(error.message);

    const kind = data.status === "in_progress" ? "start_trip"
      : data.status === "done" ? "complete_trip" : null;
    if (kind) {
      const { logTaskActivity } = await import("./activity.functions");
      await (logTaskActivity as any)({
        data: {
          kind,
          task_id: row.id,
          task_name: row.destination,
          city: data.city ?? null,
          district: data.district ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          note: data.note ?? null,
        },
      });
    }
    return { ok: true };
  });

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("trips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });