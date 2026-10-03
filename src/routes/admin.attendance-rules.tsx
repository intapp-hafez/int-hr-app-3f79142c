import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Wifi, Clock, Search, ListChecks, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  listEmployeesForAccess,
  listAllGeofences,
  listAllNetworks,
  listGeofenceAssignmentsForEmployee,
  listNetworkAssignmentsForEmployee,
  setEmployeeGeofenceAssignment,
  setEmployeeNetworkAssignment,
} from "@/backend/functions/network-assignments.functions";
import { listShifts } from "@/backend/functions/shifts.functions";
import { listEmployeeAssignments, setEmployeeAssignments } from "@/backend/functions/employee-assignments.functions";

export const Route = createFileRoute("/admin/attendance-rules")({
  head: () => ({
    meta: [
      { title: "Attendance rules — INT HR" },
      { name: "description", content: "Set each employee's allowed work locations, Wi-Fi networks and shift times for check-in." },
      { property: "og:title", content: "Attendance rules — INT HR" },
      { property: "og:description", content: "Set allowed locations, Wi-Fi networks and shift times used at check-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendanceRulesPage,
});

function AttendanceRulesPage() {
  const empFn = useServerFn(listEmployeesForAccess);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const empQ = useQuery({ queryKey: ["rules-employees"], queryFn: () => empFn() });
  const emps = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (empQ.data ?? []).filter((e: any) => !s || [e.name, e.emp_code, e.department].some((v: any) => v?.toLowerCase?.().includes(s)));
  }, [empQ.data, q]);
  const current = (empQ.data ?? []).find((e: any) => e.id === sel);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><ListChecks className="h-5 w-5 text-brand" /> Attendance rules</h1>
          <p className="text-sm text-muted-foreground">Pick an employee, then choose where, on which Wi-Fi and during which shift they can check in. The employee's check-in screen uses these rules.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link to="/admin/work-locations" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 hover:bg-muted"><Settings2 className="h-3.5 w-3.5" /> Manage locations</Link>
          <Link to="/admin/networks" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 hover:bg-muted"><Settings2 className="h-3.5 w-3.5" /> Manage Wi-Fi</Link>
          <Link to="/admin/shifts" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 hover:bg-muted"><Settings2 className="h-3.5 w-3.5" /> Manage shifts</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-border bg-card p-3">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee…" className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm" />
          </div>
          <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto">
            {empQ.isLoading && <li className="p-3 text-xs text-muted-foreground">Loading…</li>}
            {empQ.error && <li className="p-3 text-xs text-destructive">{(empQ.error as Error).message}</li>}
            {emps.map((e: any) => (
              <li key={e.id}>
                <button onClick={() => setSel(e.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${sel === e.id ? "bg-accent font-semibold" : "hover:bg-muted"}`}>
                  {e.name}
                  <span className="block text-[11px] text-muted-foreground">{[e.emp_code, e.department].filter(Boolean).join(" · ") || "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        {current ? <RulesEditor key={current.id} employeeId={current.id} name={current.name} /> : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border p-10 text-sm text-muted-foreground">Select an employee to set their rules.</div>
        )}
      </div>
    </div>
  );
}

function RulesEditor({ employeeId, name }: { employeeId: string; name: string }) {
  const qc = useQueryClient();
  const geoAll = useServerFn(listAllGeofences);
  const netAll = useServerFn(listAllNetworks);
  const shiftAll = useServerFn(listShifts);
  const geoMine = useServerFn(listGeofenceAssignmentsForEmployee);
  const netMine = useServerFn(listNetworkAssignmentsForEmployee);
  const asgMine = useServerFn(listEmployeeAssignments);
  const setGeo = useServerFn(setEmployeeGeofenceAssignment);
  const setNet = useServerFn(setEmployeeNetworkAssignment);
  const setAsg = useServerFn(setEmployeeAssignments);

  const gA = useQuery({ queryKey: ["rules-geo-all"], queryFn: () => geoAll() });
  const nA = useQuery({ queryKey: ["rules-net-all"], queryFn: () => netAll() });
  const sA = useQuery({ queryKey: ["rules-shift-all"], queryFn: () => shiftAll() });
  const gM = useQuery({ queryKey: ["rules-geo", employeeId], queryFn: () => geoMine({ data: { profileId: employeeId } }) });
  const nM = useQuery({ queryKey: ["rules-net", employeeId], queryFn: () => netMine({ data: { profileId: employeeId } }) });
  const aM = useQuery({ queryKey: ["rules-asg", employeeId], queryFn: () => asgMine({ data: { employee_id: employeeId } }) });
  const [busy, setBusy] = useState<string | null>(null);

  const geoMap = new Map(((gM.data ?? []) as any[]).map((g) => [g.id, g]));
  const netSet = new Set(((nM.data ?? []) as any[]).map((n) => n.id));
  const shiftId = (aM.data?.shift ?? [])[0] ?? "";

  async function run(key: string, fn: () => Promise<unknown>, invalidate: string) {
    setBusy(key);
    try { await fn(); await qc.invalidateQueries({ queryKey: [invalidate, employeeId] }); toast.success("Saved"); }
    catch (e: any) { toast.error(e?.message ?? "Failed to save"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold">{name}</h2>

      <Card icon={<MapPin className="h-4 w-4" />} title="Allowed work locations" hint="If none are chosen, the employee can check in from anywhere.">
        {((gA.data ?? []) as any[]).filter((l) => l.active).map((l) => {
          const mine = geoMap.get(l.id) as any;
          return (
            <div key={l.id} className="flex flex-wrap items-center gap-3 py-2">
              <Switch checked={!!mine} disabled={busy === l.id} onCheckedChange={(v) => run(l.id, () => setGeo({ data: { profileId: employeeId, locationId: l.id, assign: v } }), "rules-geo")} />
              <span className="flex-1 text-sm">{l.name}<span className="block text-[11px] text-muted-foreground">Default radius {l.radius_m} m</span></span>
              {mine && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Radius for this employee
                  <input
                    type="number" min={10} max={10000} defaultValue={mine.override_radius_m ?? ""} placeholder={String(l.radius_m)}
                    onBlur={(e) => {
                      const v = e.target.value ? Math.round(Number(e.target.value)) : null;
                      if (v === (mine.override_radius_m ?? null)) return;
                      if (v !== null && (v < 10 || v > 10000)) return toast.error("Radius must be 10–10000 m");
                      run(l.id, () => setGeo({ data: { profileId: employeeId, locationId: l.id, assign: true, radius_m: v } }), "rules-geo");
                    }}
                    className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground"
                  /> m
                </label>
              )}
            </div>
          );
        })}
        {(gA.data ?? []).length === 0 && <Empty to="/admin/work-locations" label="No work locations yet — add one first." />}
      </Card>

      <Card icon={<Wifi className="h-4 w-4" />} title="Authorized Wi-Fi networks" hint="Shown to the employee as the networks to connect to before checking in.">
        {((nA.data ?? []) as any[]).filter((n) => n.is_active).map((n) => (
          <div key={n.id} className="flex items-center gap-3 py-2">
            <Switch checked={netSet.has(n.id)} disabled={busy === n.id} onCheckedChange={(v) => run(n.id, () => setNet({ data: { profileId: employeeId, networkId: n.id, assign: v } }), "rules-net")} />
            <span className="text-sm">{n.name}<span className="block text-[11px] text-muted-foreground">{[n.ssid, n.branch].filter(Boolean).join(" · ") || "—"}</span></span>
          </div>
        ))}
        {(nA.data ?? []).length === 0 && <Empty to="/admin/networks" label="No Wi-Fi networks yet — add one first." />}
      </Card>

      <Card icon={<Clock className="h-4 w-4" />} title="Shift" hint="Used to show on time, late or too early at check-in.">
        <select
          value={shiftId}
          disabled={busy === "shift"}
          onChange={(e) => run("shift", () => setAsg({ data: { employee_id: employeeId, kind: "shift", ids: e.target.value ? [e.target.value] : [] } }), "rules-asg")}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">No fixed shift</option>
          {((sA.data ?? []) as any[]).filter((s) => s.is_active).map((s) => (
            <option key={s.id} value={s.id}>{s.name} · {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)} (grace {s.grace_minutes} min)</option>
          ))}
        </select>
      </Card>
    </div>
  );
}

function Card({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{icon} {title}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Empty({ to, label }: { to: "/admin/work-locations" | "/admin/networks"; label: string }) {
  return <Link to={to} className="block py-2 text-xs text-brand hover:underline">{label}</Link>;
}
