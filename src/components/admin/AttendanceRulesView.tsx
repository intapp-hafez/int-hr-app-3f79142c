import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Wifi, Clock, Search, ListChecks, Settings2, Loader2, UserCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { useI18n } from "@/lib/i18n";
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

export function AttendanceRulesView() {
  const { t } = useI18n();
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
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <ListChecks className="h-5 w-5 text-brand" /> {t("attendanceRules") || "Attendance rules"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick an employee, then choose where, on which Wi-Fi and during which shift they can check in. The employee's check-in screen uses these rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link to="/admin/work-locations" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 hover:bg-muted font-medium transition-colors">
            <Settings2 className="h-3.5 w-3.5" /> Manage locations
          </Link>
          <Link to="/admin/networks" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 hover:bg-muted font-medium transition-colors">
            <Settings2 className="h-3.5 w-3.5" /> Manage Wi-Fi
          </Link>
          <Link to="/admin/shifts" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 hover:bg-muted font-medium transition-colors">
            <Settings2 className="h-3.5 w-3.5" /> Manage shifts
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-border bg-card p-3 shadow-xs">
          <div className="relative mb-2">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search employee…"
              className="w-full rounded-xl border border-input bg-background py-2 ps-9 pe-3 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand"
            />
          </div>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {empQ.isLoading && (
              <li className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading employees…
              </li>
            )}
            {empQ.error && <li className="p-3 text-xs text-destructive">{(empQ.error as Error).message}</li>}
            {!empQ.isLoading && emps.length === 0 && (
              <li className="p-6 text-center text-xs text-muted-foreground">No employees found.</li>
            )}
            {emps.map((e: any) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSel(e.id)}
                  className={`w-full rounded-xl p-2.5 text-start text-sm transition-colors flex items-center gap-2.5 ${
                    sel === e.id
                      ? "bg-accent font-semibold text-accent-foreground shadow-xs"
                      : "hover:bg-muted/70 text-foreground"
                  }`}
                >
                  <EmployeeAvatar id={e.id} name={e.name} className="h-8 w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{e.name}</p>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[e.emp_code, e.department].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        {current ? (
          <RulesEditor key={current.id} employeeId={current.id} name={current.name} />
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-sm text-muted-foreground min-h-[300px]">
            <div className="max-w-xs space-y-2">
              <UserCheck className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="font-medium text-foreground">Select an employee</p>
              <p className="text-xs text-muted-foreground">
                Choose an employee from the left sidebar to configure their allowed work locations, authorized Wi-Fi networks, and shift timings.
              </p>
            </div>
          </div>
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
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: [invalidate, employeeId] });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <EmployeeAvatar id={employeeId} name={name} className="h-10 w-10 shrink-0" />
        <div>
          <h2 className="font-display text-lg font-semibold">{name}</h2>
          <p className="text-xs text-muted-foreground">Individual attendance constraints & policy assignment</p>
        </div>
      </div>

      <Card
        icon={<MapPin className="h-4 w-4 text-brand" />}
        title="Allowed work locations"
        hint="If none are chosen, the employee can check in from anywhere."
      >
        {((gA.data ?? []) as any[]).filter((l) => l.active).map((l) => {
          const mine = geoMap.get(l.id) as any;
          return (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!mine}
                  disabled={busy === l.id}
                  onCheckedChange={(v) =>
                    run(
                      l.id,
                      () => setGeo({ data: { profileId: employeeId, locationId: l.id, assign: v } }),
                      "rules-geo",
                    )
                  }
                />
                <div>
                  <span className="text-sm font-medium">{l.name}</span>
                  <span className="block text-[11px] text-muted-foreground">Default radius {l.radius_m} m</span>
                </div>
              </div>
              {mine && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg">
                  Radius override
                  <input
                    type="number"
                    min={10}
                    max={10000}
                    defaultValue={mine.override_radius_m ?? ""}
                    placeholder={String(l.radius_m)}
                    onBlur={(e) => {
                      const v = e.target.value ? Math.round(Number(e.target.value)) : null;
                      if (v === (mine.override_radius_m ?? null)) return;
                      if (v !== null && (v < 10 || v > 10000)) return toast.error("Radius must be 10–10000 m");
                      run(
                        l.id,
                        () => setGeo({ data: { profileId: employeeId, locationId: l.id, assign: true, radius_m: v } }),
                        "rules-geo",
                      );
                    }}
                    className="w-20 rounded-md border border-input bg-background px-2 py-0.5 text-xs text-foreground focus:outline-hidden"
                  />
                  m
                </label>
              )}
            </div>
          );
        })}
        {(gA.data ?? []).length === 0 && (
          <Empty to="/admin/work-locations" label="No work locations yet — add one first." />
        )}
      </Card>

      <Card
        icon={<Wifi className="h-4 w-4 text-brand" />}
        title="Authorized Wi-Fi networks"
        hint="Shown to the employee as the networks to connect to before checking in."
      >
        {((nA.data ?? []) as any[]).filter((n) => n.is_active).map((n) => (
          <div key={n.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={netSet.has(n.id)}
                disabled={busy === n.id}
                onCheckedChange={(v) =>
                  run(
                    n.id,
                    () => setNet({ data: { profileId: employeeId, networkId: n.id, assign: v } }),
                    "rules-net",
                  )
                }
              />
              <div>
                <span className="text-sm font-medium">{n.name}</span>
                <span className="block text-[11px] text-muted-foreground font-mono">
                  {[n.ssid, n.branch].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
            </div>
          </div>
        ))}
        {(nA.data ?? []).length === 0 && (
          <Empty to="/admin/networks" label="No Wi-Fi networks yet — add one first." />
        )}
      </Card>

      <Card
        icon={<Clock className="h-4 w-4 text-brand" />}
        title="Shift assignment"
        hint="Used to determine on-time, late, or early status at check-in."
      >
        <div className="py-2">
          <select
            value={shiftId}
            disabled={busy === "shift"}
            onChange={(e) =>
              run(
                "shift",
                () =>
                  setAsg({
                    data: { employee_id: employeeId, kind: "shift", ids: e.target.value ? [e.target.value] : [] },
                  }),
                "rules-asg",
              )
            }
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand"
          >
            <option value="">No fixed shift</option>
            {((sA.data ?? []) as any[]).filter((s) => s.is_active).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)} (grace {s.grace_minutes} min)
              </option>
            ))}
          </select>
        </div>
      </Card>
    </div>
  );
}

function Card({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{icon} {title}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Empty({ to, label }: { to: "/admin/work-locations" | "/admin/networks"; label: string }) {
  return (
    <div className="py-3">
      <Link to={to} className="text-xs text-brand hover:underline font-medium">
        {label}
      </Link>
    </div>
  );
}
