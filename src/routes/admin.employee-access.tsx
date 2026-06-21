import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Wifi, Search, Check, AlertTriangle, Users, Loader2 } from "lucide-react";
import {
  listEmployeesForAccess,
  listAllNetworks,
  listAllGeofences,
  listNetworkAssignmentsForEmployee,
  setEmployeeNetworkAssignment,
  listGeofenceAssignmentsForEmployee,
  setEmployeeGeofenceAssignment,
} from "@/backend/functions/network-assignments.functions";

export const Route = createFileRoute("/admin/employee-access")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const empFn = useServerFn(listEmployeesForAccess);
  const netsFn = useServerFn(listAllNetworks);
  const geosFn = useServerFn(listAllGeofences);
  const empListNets = useServerFn(listNetworkAssignmentsForEmployee);
  const empListGeos = useServerFn(listGeofenceAssignmentsForEmployee);
  const toggleNet = useServerFn(setEmployeeNetworkAssignment);
  const toggleGeo = useServerFn(setEmployeeGeofenceAssignment);

  const empQ = useQuery({ queryKey: ["access", "employees"], queryFn: () => empFn() });
  const netsQ = useQuery({ queryKey: ["access", "networks"], queryFn: () => netsFn() });
  const geosQ = useQuery({ queryKey: ["access", "geofences"], queryFn: () => geosFn() });

  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const employees = empQ.data ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return employees;
    return employees.filter((e: any) =>
      e.name.toLowerCase().includes(s) ||
      (e.emp_code ?? "").toLowerCase().includes(s) ||
      (e.department ?? "").toLowerCase().includes(s),
    );
  }, [employees, q]);

  const assignedNetsQ = useQuery({
    queryKey: ["access", "emp-networks", selectedId],
    queryFn: () => empListNets({ data: { profileId: selectedId! } }),
    enabled: !!selectedId,
  });
  const assignedGeosQ = useQuery({
    queryKey: ["access", "emp-geos", selectedId],
    queryFn: () => empListGeos({ data: { profileId: selectedId! } }),
    enabled: !!selectedId,
  });

  const netSet = new Set((assignedNetsQ.data ?? []).map((n: any) => n.id));
  const geoSet = new Set((assignedGeosQ.data ?? []).map((g: any) => g.id));

  const netMut = useMutation({
    mutationFn: (v: { networkId: string; assign: boolean }) =>
      toggleNet({ data: { profileId: selectedId!, ...v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access", "emp-networks", selectedId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const geoMut = useMutation({
    mutationFn: (v: { locationId: string; assign: boolean }) =>
      toggleGeo({ data: { profileId: selectedId!, ...v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access", "emp-geos", selectedId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const nets = netsQ.data ?? [];
  const geos = geosQ.data ?? [];
  const selectedEmp = employees.find((e: any) => e.id === selectedId);
  const hasAnyAccess = (assignedNetsQ.data?.length ?? 0) + (assignedGeosQ.data?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Employee access</h1>
        <p className="text-sm text-muted-foreground">
          Assign allowed locations and authorized Wi-Fi networks per employee. Employees with no
          assignments can check in from anywhere (free check-in).
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Employees list */}
        <aside className="lg:col-span-2 rounded-3xl border border-border bg-card p-3">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search employees…"
              className="w-full rounded-xl border border-input bg-background py-2 ps-9 pe-3 text-sm"
            />
          </div>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {empQ.isLoading && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </li>
            )}
            {filtered.map((e: any) => {
              const active = e.id === selectedId;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setSelectedId(e.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm transition-colors ${
                      active ? "bg-brand text-brand-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{e.name}</span>
                      <span className={`block text-[11px] ${active ? "text-brand-foreground/80" : "text-muted-foreground"}`}>
                        {e.emp_code ?? "—"}{e.department ? ` · ${e.department}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!empQ.isLoading && filtered.length === 0 && (
              <li className="py-6 text-center text-xs text-muted-foreground">No employees</li>
            )}
          </ul>
        </aside>

        {/* Detail panel */}
        <section className="lg:col-span-3 space-y-4">
          {!selectedId ? (
            <div className="grid h-full place-items-center rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <div>
                <Users className="mx-auto mb-2 h-6 w-6" />
                Select an employee to manage their allowed locations and networks.
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-border bg-card p-4">
                <p className="font-display text-lg font-semibold">{selectedEmp?.name}</p>
                {!hasAnyAccess && !assignedNetsQ.isLoading && !assignedGeosQ.isLoading && (
                  <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
                    <AlertTriangle className="h-3 w-3" /> Free check-in (no constraints assigned)
                  </p>
                )}
                {hasAnyAccess && (
                  <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
                    <Check className="h-3 w-3" /> Restricted to assigned locations or networks
                  </p>
                )}
              </div>

              {/* Geofences */}
              <div className="rounded-3xl border border-border bg-card">
                <header className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-brand" /> Allowed locations
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {assignedGeosQ.data?.length ?? 0} / {geos.length} assigned
                  </span>
                </header>
                <ul className="divide-y divide-border">
                  {geos.length === 0 && (
                    <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No geofence locations defined.
                    </li>
                  )}
                  {geos.map((g: any) => {
                    const checked = geoSet.has(g.id);
                    return (
                      <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">
                            {g.name}{" "}
                            {!g.active && (
                              <span className="ms-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase">off</span>
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {g.lat.toFixed(4)}, {g.lng.toFixed(4)} · {g.radius_m} m
                          </p>
                        </div>
                        <button
                          disabled={geoMut.isPending || !g.active}
                          onClick={() => geoMut.mutate({ locationId: g.id, assign: !checked })}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            checked ? "bg-destructive/10 text-destructive" : "bg-gradient-brand text-brand-foreground"
                          } disabled:opacity-50`}
                        >
                          {checked ? "Remove" : "Assign"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Networks */}
              <div className="rounded-3xl border border-border bg-card">
                <header className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold">
                    <Wifi className="h-4 w-4 text-brand" /> Authorized networks
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {assignedNetsQ.data?.length ?? 0} / {nets.length} assigned
                  </span>
                </header>
                <ul className="divide-y divide-border">
                  {nets.length === 0 && (
                    <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No networks defined yet.
                    </li>
                  )}
                  {nets.map((n: any) => {
                    const checked = netSet.has(n.id);
                    const invalid = !n.ssid;
                    return (
                      <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">
                            {n.name}
                            {!n.is_active && (
                              <span className="ms-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase">off</span>
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            SSID: {n.ssid ?? "—"}{n.bssid ? ` · ${n.bssid}` : ""}
                            {n.branch ? ` · ${n.branch}` : ""}
                          </p>
                          {invalid && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-warning-foreground">
                              <AlertTriangle className="h-3 w-3" /> Missing SSID — won't match check-ins
                            </p>
                          )}
                        </div>
                        <button
                          disabled={netMut.isPending || !n.is_active || invalid}
                          onClick={() => {
                            if (invalid) return toast.error("This network has no SSID — edit it first in Networks.");
                            netMut.mutate({ networkId: n.id, assign: !checked });
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            checked ? "bg-destructive/10 text-destructive" : "bg-gradient-brand text-brand-foreground"
                          } disabled:opacity-50`}
                        >
                          {checked ? "Remove" : "Assign"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}