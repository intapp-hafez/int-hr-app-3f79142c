import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuditEventRow = {
  id: string;
  ts: number;
  employeeId: string;
  employeeName: string;
  action: "check-in" | "check-out";
  result: "success" | "blocked";
  branch: string | null;
  gps: "ok" | "fail";
  network: "ok" | "fail";
  ssid: string | null;
  distanceM: number | null;
  reason: string | null;
  device: string | null;
};

export const getAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditEventRow[]> => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await supabase
      .from("attendance")
      .select(
        "id, employee_id, date, in_time, out_time, branch, status, lat, lng, network_ok, note, city, district, created_at, profiles:employee_id(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const rows: AuditEventRow[] = [];
    for (const r of (data ?? []) as any[]) {
      const name = r.profiles?.full_name ?? "Unknown";
      const branch = r.branch ?? ([r.city, r.district].filter(Boolean).join(" • ") || null);
      const gps: "ok" | "fail" = r.lat != null && r.lng != null ? "ok" : "fail";
      const network: "ok" | "fail" = r.network_ok === false ? "fail" : "ok";
      const blocked = r.status === "blocked" || r.status === "rejected";
      if (r.in_time) {
        rows.push({
          id: `${r.id}-in`,
          ts: new Date(r.in_time).getTime(),
          employeeId: r.employee_id,
          employeeName: name,
          action: "check-in",
          result: blocked ? "blocked" : "success",
          branch,
          gps,
          network,
          ssid: null,
          distanceM: null,
          reason: r.note ?? (blocked ? "Check-in blocked" : `Checked in at ${new Date(r.in_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`),
          device: null,
        });
      }
      if (r.out_time) {
        rows.push({
          id: `${r.id}-out`,
          ts: new Date(r.out_time).getTime(),
          employeeId: r.employee_id,
          employeeName: name,
          action: "check-out",
          result: "success",
          branch,
          gps,
          network,
          ssid: null,
          distanceM: null,
          reason: `Checked out at ${new Date(r.out_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
          device: null,
        });
      }
    }
    rows.sort((a, b) => b.ts - a.ts);
    return rows;
  });