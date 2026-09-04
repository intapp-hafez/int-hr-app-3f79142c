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

export type AlertKind =
  | "id_expiry"
  | "contract_expiry"
  | "insurance_expiry"
  | "military_expiry"
  | "probation_end"
  | "pending_leave"
  | "advance_payment"
  | "late"
  | "absent"
  | "checkin"
  | "checkout";

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
    const todayMs = new Date(today + "T00:00:00Z").getTime();
    const in30Iso = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const past30Iso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const { supabase } = context;
    const [pend, att, totalEmp, expiringProfiles, pendingAdvances] = await Promise.all([
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
      // Profiles with upcoming or recent expirations
      supabase
        .from("profiles")
        .select("id, full_name, emp_code, id_expiry_date, contract_end_date, contract_cancelled, contract_start_date, contract_type, social_insurance_date, military_expire_date, status")
        .neq("status", "Inactive")
        .or(`id_expiry_date.lte.${in30Iso},contract_end_date.lte.${in30Iso},military_expire_date.lte.${in30Iso}`)
        .limit(60),
      // Pending salary advances
      (supabase as any)
        .from("employee_advances")
        .select("id, amount, created_at, status, profiles:employee_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    const alerts: AdminAlert[] = [];

    // 1. Pending Leaves
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

    // 2. Pending Advances
    for (const adv of (pendingAdvances?.data ?? []) as any[]) {
      alerts.push({
        id: `adv-${adv.id}`,
        kind: "advance_payment",
        severity: "warning",
        title: `${adv.profiles?.full_name ?? "Employee"} requested advance payment`,
        description: `Amount: ${adv.amount ?? 0} • Pending approval`,
        ts: adv.created_at ?? new Date().toISOString(),
        link: "/admin/payroll",
      });
    }

    // 3. Document and Contract Expirations
    for (const p of (expiringProfiles.data ?? []) as any[]) {
      const name = p.full_name || p.emp_code || "Employee";

      // National ID Expiration
      if (p.id_expiry_date) {
        const expMs = new Date(p.id_expiry_date + "T00:00:00Z").getTime();
        const diffDays = Math.ceil((expMs - todayMs) / 86400000);
        if (diffDays <= 30 && diffDays >= -60) {
          const isExpired = diffDays <= 0;
          alerts.push({
            id: `id-exp-${p.id}-${p.id_expiry_date}`,
            kind: "id_expiry",
            severity: isExpired ? "danger" : diffDays <= 7 ? "warning" : "info",
            title: `National ID ${isExpired ? "Expired" : "Expiring Soon"}: ${name}`,
            description: `Expires ${p.id_expiry_date} (${isExpired ? `${Math.abs(diffDays)}d ago` : `in ${diffDays}d`})`,
            ts: new Date().toISOString(),
            link: `/admin/employees/${p.id}`,
          });
        }
      }

      // Contract Expiration
      if (p.contract_end_date && !p.contract_cancelled) {
        const expMs = new Date(p.contract_end_date + "T00:00:00Z").getTime();
        const diffDays = Math.ceil((expMs - todayMs) / 86400000);
        if (diffDays <= 30 && diffDays >= -60) {
          const isExpired = diffDays <= 0;
          alerts.push({
            id: `contract-exp-${p.id}-${p.contract_end_date}`,
            kind: "contract_expiry",
            severity: isExpired ? "danger" : diffDays <= 7 ? "warning" : "info",
            title: `Contract ${isExpired ? "Expired" : "Ending Soon"}: ${name}`,
            description: `Ends ${p.contract_end_date} (${isExpired ? `${Math.abs(diffDays)}d ago` : `in ${diffDays}d`})`,
            ts: new Date().toISOString(),
            link: `/admin/contracts`,
          });
        }
      }

      // Military Status Expiration
      if (p.military_expire_date) {
        const expMs = new Date(p.military_expire_date + "T00:00:00Z").getTime();
        const diffDays = Math.ceil((expMs - todayMs) / 86400000);
        if (diffDays <= 30 && diffDays >= -60) {
          const isExpired = diffDays <= 0;
          alerts.push({
            id: `mil-exp-${p.id}-${p.military_expire_date}`,
            kind: "military_expiry",
            severity: isExpired ? "danger" : "warning",
            title: `Military Certificate ${isExpired ? "Expired" : "Expiring"}: ${name}`,
            description: `Expires ${p.military_expire_date} (${isExpired ? `${Math.abs(diffDays)}d ago` : `in ${diffDays}d`})`,
            ts: new Date().toISOString(),
            link: `/admin/employees/${p.id}`,
          });
        }
      }

      // Probation Period Ending (for Probation contracts or first 3 months)
      if (p.contract_type === "Probation3M" && p.contract_start_date) {
        const startMs = new Date(p.contract_start_date + "T00:00:00Z").getTime();
        const probEndMs = startMs + 90 * 86400000;
        const diffDays = Math.ceil((probEndMs - todayMs) / 86400000);
        if (diffDays <= 14 && diffDays >= -14) {
          alerts.push({
            id: `prob-end-${p.id}`,
            kind: "probation_end",
            severity: diffDays <= 0 ? "warning" : "info",
            title: `Probation Ending: ${name}`,
            description: `3-month probation period concludes in ${Math.max(0, diffDays)} days`,
            ts: new Date().toISOString(),
            link: `/admin/employees/${p.id}`,
          });
        }
      }
    }

    // 4. Attendance
    let lateCount = 0;
    let checkoutCount = 0;
    for (const r of (att.data ?? []) as any[]) {
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
      alerts: alerts.slice(0, 50),
      counts: {
        pendingLeaves: (pend.data ?? []).length,
        late: lateCount,
        absent: absentCount,
        checkout: checkoutCount,
        total: alerts.length,
      },
    };
  });