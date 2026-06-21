import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

function dateKey(d: Date) { return d.toISOString().slice(0, 10); }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

const TrendInput = z.object({
  range: z.enum(["7d", "14d", "30d", "90d"]).default("7d"),
  granularity: z.enum(["daily", "weekly"]).default("daily"),
});

export const getAttendanceTrend = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => TrendInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const days = data.range === "7d" ? 7 : data.range === "14d" ? 14 : data.range === "30d" ? 30 : 90;
    const end = startOfDay(new Date());
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const [{ data: rows, error }, { count: totalEmployees }] = await Promise.all([
      context.supabase
        .from("attendance")
        .select("date,status")
        .gte("date", dateKey(start))
        .lte("date", dateKey(end)),
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    if (error) throw new Error(error.message);

    const total = totalEmployees ?? 0;
    const buckets = new Map<string, { date: string; present: number; late: number; absent: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = dateKey(d);
      buckets.set(k, { date: k, present: 0, late: 0, absent: 0 });
    }
    for (const r of rows ?? []) {
      const b = buckets.get(r.date as string);
      if (!b) continue;
      if (r.status === "present") b.present++;
      else if (r.status === "late") b.late++;
    }
    for (const b of buckets.values()) {
      b.absent = Math.max(0, total - b.present - b.late);
    }

    let series = Array.from(buckets.values());
    if (data.granularity === "weekly") {
      const weekly: { date: string; present: number; late: number; absent: number; label: string }[] = [];
      for (let i = 0; i < series.length; i += 7) {
        const chunk = series.slice(i, i + 7);
        const startD = chunk[0].date;
        const endD = chunk[chunk.length - 1].date;
        weekly.push({
          date: startD,
          label: `${startD.slice(5)} – ${endD.slice(5)}`,
          present: Math.round(chunk.reduce((s, c) => s + c.present, 0) / chunk.length),
          late: Math.round(chunk.reduce((s, c) => s + c.late, 0) / chunk.length),
          absent: Math.round(chunk.reduce((s, c) => s + c.absent, 0) / chunk.length),
        });
      }
      return { totalEmployees: total, series: weekly };
    }
    return {
      totalEmployees: total,
      series: series.map((s) => ({ ...s, label: s.date.slice(5) })),
    };
  });

export type AlertKind = "pending_leave" | "late" | "absent" | "checkin" | "checkout";
export type AdminAlert = {
  id: string;
  kind: AlertKind;
  severity: "info" | "warning" | "danger";
  title: string;
  description: string;
  ts: string; // ISO
  link?: string;
};

export const getAdminAlerts = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const today = dateKey(new Date());
    const { supabase } = context;
    const [pend, att, totalEmp] = await Promise.all([
      supabase
        .from("leaves")
        .select("id, leave_type_name, start_date, end_date, created_at, profiles:employee_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("attendance")
        .select("id, status, in_time, out_time, branch, employee_id, profiles:employee_id(full_name)")
        .eq("date", today)
        .order("in_time", { ascending: false })
        .limit(40),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    const alerts: AdminAlert[] = [];

    for (const r of (pend.data ?? []) as any[]) {
      alerts.push({
        id: `leave-${r.id}`,
        kind: "pending_leave",
        severity: "warning",
        title: `${r.profiles?.full_name ?? "Employee"} requested ${r.leave_type_name ?? "leave"}`,
        description: `${r.start_date} → ${r.end_date}`,
        ts: r.created_at,
        link: "/admin/leaves-requests",
      });
    }

    let lateCount = 0;
    let checkoutCount = 0;
    for (const r of (att.data ?? []) as any[]) {
      // Check-out event (if employee already left)
      if (r.out_time) {
        checkoutCount++;
        alerts.push({
          id: `out-${r.id}`,
          kind: "checkout",
          severity: "info",
          title: `${r.profiles?.full_name ?? "Employee"} checked out`,
          description: `${r.branch ?? "—"} • ${new Date(r.out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          ts: r.out_time,
          link: "/admin/attendance",
        });
      }
      if (r.status === "late") {
        lateCount++;
        alerts.push({
          id: `att-${r.id}`,
          kind: "late",
          severity: "danger",
          title: `${r.profiles?.full_name ?? "Employee"} checked in late`,
          description: `${r.branch ?? "—"} • ${r.in_time ? new Date(r.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}`,
          ts: r.in_time ?? new Date().toISOString(),
          link: "/admin/attendance",
        });
      } else if (r.status === "present" && r.in_time) {
        alerts.push({
          id: `att-${r.id}`,
          kind: "checkin",
          severity: "info",
          title: `${r.profiles?.full_name ?? "Employee"} checked in`,
          description: `${r.branch ?? "—"} • ${new Date(r.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          ts: r.in_time,
          link: "/admin/attendance",
        });
      }
    }

    const total = totalEmp.count ?? 0;
    const checkedIn = (att.data ?? []).length;
    const absentCount = Math.max(0, total - checkedIn);
    if (absentCount > 0) {
      alerts.push({
        id: `absent-${today}`,
        kind: "absent",
        severity: absentCount > Math.max(3, Math.round(total * 0.2)) ? "danger" : "warning",
        title: `${absentCount} employee${absentCount === 1 ? "" : "s"} not checked in`,
        description: `As of ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        ts: new Date().toISOString(),
        link: "/admin/attendance",
      });
    }

    alerts.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    return {
      alerts: alerts.slice(0, 40),
      counts: {
        pendingLeaves: (pend.data ?? []).length,
        late: lateCount,
        absent: absentCount,
        checkout: checkoutCount,
        total: alerts.length,
      },
    };
  });