import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Calendar, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { getTripAllowanceEnabled, setTripAllowanceEnabled } from "@/backend/functions/devices.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export function EmployeeTripsPanel({ employeeId }: { employeeId: string }) {
  return (
    <div className="space-y-4">
      <TripAllowanceSwitch employeeId={employeeId} />
      <MonthlyTripAllowance employeeId={employeeId} />
    </div>
  );
}

function TripAllowanceSwitch({ employeeId }: { employeeId: string }) {
  const getFn = useServerFn(getTripAllowanceEnabled);
  const setFn = useServerFn(setTripAllowanceEnabled);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["employee-trip-allowance-enabled", employeeId],
    queryFn: () => getFn({ data: { user_id: employeeId } }),
  });
  const enabled = data?.enabled !== false;
  async function toggle() {
    try {
      await setFn({ data: { user_id: employeeId, enabled: !enabled } });
      toast.success(!enabled ? "Trip allowance turned on" : "Trip allowance turned off");
      qc.invalidateQueries({ queryKey: ["employee-trip-allowance-enabled", employeeId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Has trip allowance</p>
        <p className="text-xs text-muted-foreground">
          {enabled ? "Days checked in at a work location earn that location's allowance." : "Off: this employee earns no trip allowance."}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label="Has trip allowance"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-gradient-brand" : "bg-border"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-all ${enabled ? "left-6 rtl:right-6 rtl:left-auto" : "left-1 rtl:right-1 rtl:left-auto"}`} />
      </button>
    </div>
  );
}

function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, r = (d: number) => (d * Math.PI) / 180;
  const s = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Monthly allowance: each day checked in inside a work location earns the
 * rate set for the employee's position at that location (Allowances → Trips). */
function MonthlyTripAllowance({ employeeId }: { employeeId: string }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data: en } = useQuery({ queryKey: ["employee-trip-allowance-enabled", employeeId], enabled: false }) as any;
  const enabled = en?.enabled !== false;

  const { data, isLoading, error } = useQuery({
    queryKey: ["monthly-trip-allowance", employeeId, month],
    queryFn: async () => {
      const [y, m] = month.split("-").map(Number);
      const from = `${month}-01`;
      const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const [prof, att, locs] = await Promise.all([
        (supabase as any).from("profiles").select("position_id").eq("id", employeeId).maybeSingle(),
        supabase.from("attendance").select("date, in_time, lat, lng").eq("employee_id", employeeId).gte("date", from).lte("date", to).order("date"),
        supabase.from("geofence_locations").select("id, name, lat, lng, radius_m, active"),
      ]);
      if (att.error) throw new Error(att.error.message);
      const positionId = prof.data?.position_id ?? null;
      let rates = new Map<string, number>();
      if (positionId) {
        const pol = await (supabase as any).from("trip_allowance_policies").select("geofence_location_id, nightly_rate").eq("position_id", positionId);
        for (const p of pol.data ?? []) rates.set(p.geofence_location_id, Number(p.nightly_rate) || 0);
      }
      const fences = (locs.data ?? []).filter((l: any) => l.active !== false && l.lat != null && l.lng != null);
      const rows = (att.data ?? []).map((a: any) => {
        let loc: any = null, best = Infinity;
        if (a.lat != null && a.lng != null) for (const f of fences) {
          const d = distM(a.lat, a.lng, f.lat, f.lng);
          if (d <= (f.radius_m ?? 0) && d < best) { best = d; loc = f; }
        }
        const rate = loc && rates.has(loc.id) ? rates.get(loc.id)! : null;
        return { date: a.date as string, time: a.in_time as string | null, location: loc?.name ?? null, rate };
      });
      return { positionId, rows };
    },
  });

  const total = useMemo(() => (enabled ? (data?.rows ?? []).reduce((s, r) => s + (r.rate ?? 0), 0) : 0), [data, enabled]);
  const fmt = (d: string) => d.split("-").reverse().join("-");

  return (
    <div className="space-y-3 rounded-2xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold"><Calendar className="h-4 w-4" /> Monthly trip allowance</p>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-xl border border-input bg-background px-3 text-sm" />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : error ? <p className="text-sm text-destructive">{(error as Error).message}</p>
        : !data?.positionId ? <p className="text-sm text-muted-foreground">This employee has no position, so no allowance rate applies.</p>
        : data.rows.length === 0 ? <p className="text-sm text-muted-foreground">No check-ins this month.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-2 py-2 text-start">Date</th><th className="px-2 py-2 text-start">Check-in</th><th className="px-2 py-2 text-start">Work location</th><th className="px-2 py-2 text-end">Allowance (EGP)</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((r) => (
                  <tr key={r.date}>
                    <td className="px-2 py-2">{fmt(r.date)}</td>
                    <td className="px-2 py-2">{r.time ? new Date(r.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="px-2 py-2">{r.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-brand" />{r.location}</span> : <span className="text-muted-foreground">Outside work locations</span>}</td>
                    <td className="px-2 py-2 text-end font-mono">{enabled && r.rate != null ? r.rate : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-border font-semibold"><td colSpan={3} className="px-2 py-2">Total</td><td className="px-2 py-2 text-end font-mono">{total}</td></tr></tfoot>
            </table>
          </div>
        )}
    </div>
  );
}
