import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Wifi, Search, Check, AlertTriangle, Users, Loader2, Smartphone } from "lucide-react";
import {
  listEmployeesForAccess,
  listAllNetworks,
  listAllGeofences,
  listNetworkAssignmentsForEmployee,
  setEmployeeNetworkAssignment,
  listGeofenceAssignmentsForEmployee,
  setEmployeeGeofenceAssignment,
} from "@/backend/functions/network-assignments.functions";
import {
  getDeviceRequirement,
  setDeviceRequirement,
} from "@/backend/functions/devices.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/employee-access")({ component: Page });

function Page() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const empFn = useServerFn(listEmployeesForAccess);
  const netsFn = useServerFn(listAllNetworks);
  const geosFn = useServerFn(listAllGeofences);
  const empListNets = useServerFn(listNetworkAssignmentsForEmployee);
  const empListGeos = useServerFn(listGeofenceAssignmentsForEmployee);
  const toggleNet = useServerFn(setEmployeeNetworkAssignment);
  const toggleGeo = useServerFn(setEmployeeGeofenceAssignment);
  const devGetFn = useServerFn(getDeviceRequirement);
  const devSetFn = useServerFn(setDeviceRequirement);

  const empQ = useQuery({ queryKey: ["access", "employees"], queryFn: () => empFn() });
  const netsQ = useQuery({ queryKey: ["access", "networks"], queryFn: () => netsFn() });
  const geosQ = useQuery({ queryKey: ["access", "geofences"], queryFn: () => geosFn() });

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const employees = empQ.data ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return employees;
    const sDigits = s.replace(/\D/g, "");
    return employees.filter((e: any) =>
      (e.name ?? "").toLowerCase().includes(s) ||
      (e.email ?? "").toLowerCase().includes(s) ||
      (e.phone ?? "").toLowerCase().includes(s) ||
      (sDigits && (e.phone ?? "").replace(/\D/g, "").includes(sDigits)) ||
      (e.emp_code ?? "").toLowerCase().includes(s) ||
      (e.national_id ?? "").toLowerCase().includes(s) ||
      (e.id ?? "").toLowerCase().includes(s) ||
      (e.department ?? "").toLowerCase().includes(s),
    );
  }, [employees, q]);

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

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

  const devReqQ = useQuery({
    queryKey: ["employee-device-requirement", selectedId],
    queryFn: () => devGetFn({ data: { user_id: selectedId! } }),
    enabled: !!selectedId,
  });

  const devMut = useMutation({
    mutationFn: (required: boolean) => devSetFn({ data: { user_id: selectedId!, required } }),
    onSuccess: (_d, req) => {
      toast.success(req ? "Approved device required for check-in" : "Any device allowed for check-in");
      qc.invalidateQueries({ queryKey: ["employee-device-requirement", selectedId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const netSet = new Set((assignedNetsQ.data ?? []).map((n: any) => n.id));
  const geoSet = new Set((assignedGeosQ.data ?? []).map((g: any) => g.id));
  const assignedGeoMap = new Map<string, number | null>(
    (assignedGeosQ.data ?? []).map((g: any) => [g.id, g.override_radius_m ?? null])
  );

  const netMut = useMutation({
    mutationFn: (v: { networkId: string; assign: boolean }) =>
      toggleNet({ data: { profileId: selectedId!, ...v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access", "emp-networks", selectedId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const geoMut = useMutation({
    mutationFn: (v: { locationId: string; assign: boolean; radius_m?: number | null }) =>
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

  const [geoQ, setGeoQ] = useState("");
  const [geoPage, setGeoPage] = useState(1);
  const [geoTab, setGeoTab] = useState<"all" | "assigned">("all");

  const filteredGeos = useMemo(() => {
    let list = geos;
    if (geoTab === "assigned") {
      list = list.filter((g: any) => geoSet.has(g.id));
    }
    const s = geoQ.trim().toLowerCase();
    if (!s) return list;
    return list.filter((g: any) =>
      (g.name ?? "").toLowerCase().includes(s) ||
      (g.address ?? "").toLowerCase().includes(s),
    );
  }, [geos, geoTab, geoSet, geoQ]);

  const GEO_PAGE_SIZE = 50;
  const totalGeoPages = Math.max(1, Math.ceil(filteredGeos.length / GEO_PAGE_SIZE));
  const paginatedGeos = useMemo(() => {
    const start = (geoPage - 1) * GEO_PAGE_SIZE;
    return filteredGeos.slice(start, start + GEO_PAGE_SIZE);
  }, [filteredGeos, geoPage]);

  useEffect(() => {
    setGeoPage(1);
  }, [selectedId]);

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
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
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
            {paginated.map((e: any) => {
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

          {filtered.length > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 px-1 text-xs text-muted-foreground">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Prev
                </button>
                <span className="px-1 font-mono text-[11px]">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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

                {/* Device check gate switch */}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-brand" />
                    <div>
                      <p className="text-xs font-semibold">{t("approvedDeviceRequirement") || "Approved device requirement"}</p>
                      <p className="text-[11px] text-muted-foreground">{t("requireApprovedDeviceTitle") || "Require an approved device to check in"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={devMut.isPending || devReqQ.isLoading}
                    onClick={() => devMut.mutate(!devReqQ.data?.required)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      devReqQ.data?.required ? "bg-gradient-brand" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${
                        devReqQ.data?.required ? "left-5 rtl:right-5 rtl:left-auto" : "left-0.5 rtl:right-0.5 rtl:left-auto"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Geofences */}
              <div className="rounded-3xl border border-border bg-card">
                <header className="flex flex-col gap-2.5 border-b border-border p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold">
                      <MapPin className="h-4 w-4 text-brand" /> Allowed locations
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {assignedGeosQ.data?.length ?? 0} / {geos.length} assigned
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={geoQ}
                        onChange={(e) => {
                          setGeoQ(e.target.value);
                          setGeoPage(1);
                        }}
                        placeholder="Search locations…"
                        className="w-full rounded-xl border border-input bg-background py-1.5 ps-8 pe-3 text-xs"
                      />
                    </div>
                    <div className="flex items-center rounded-xl border border-border bg-muted/40 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setGeoTab("all");
                          setGeoPage(1);
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          geoTab === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All ({geos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGeoTab("assigned");
                          setGeoPage(1);
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          geoTab === "assigned" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Assigned ({assignedGeosQ.data?.length ?? 0})
                      </button>
                    </div>
                  </div>
                </header>

                <ul className="divide-y divide-border">
                  {geos.length === 0 && (
                    <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No geofence locations defined.
                    </li>
                  )}
                  {geos.length > 0 && paginatedGeos.length === 0 && (
                    <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No matching locations found.
                    </li>
                  )}
                  {paginatedGeos.map((g: any) => {
                    const checked = geoSet.has(g.id);
                    const overrideRadius = assignedGeoMap.get(g.id);
                    return (
                      <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {g.name}{" "}
                            {!g.active && (
                              <span className="ms-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase">off</span>
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {g.lat.toFixed(4)}, {g.lng.toFixed(4)} · {g.radius_m} m default
                          </p>
                          {checked && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[11px] text-muted-foreground">Custom radius:</span>
                              <input
                                type="number"
                                min={10}
                                max={10000}
                                step={10}
                                placeholder={`${g.radius_m}m default`}
                                defaultValue={overrideRadius != null ? String(overrideRadius) : ""}
                                key={`${selectedId}-${g.id}-${overrideRadius}`}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  const num = v ? parseInt(v, 10) : null;
                                  if (num !== overrideRadius) {
                                    geoMut.mutate({
                                      locationId: g.id,
                                      assign: true,
                                      radius_m: num && !isNaN(num) && num > 0 ? num : null,
                                    });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                }}
                                className="w-24 rounded-lg border border-input bg-background px-2 py-0.5 text-xs font-mono text-end placeholder:text-muted-foreground/60"
                              />
                              <span className="text-[11px] text-muted-foreground">m</span>
                            </div>
                          )}
                        </div>
                        <button
                          disabled={geoMut.isPending || !g.active}
                          onClick={() => geoMut.mutate({ locationId: g.id, assign: !checked })}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold shrink-0 ${
                            checked ? "bg-destructive/10 text-destructive" : "bg-gradient-brand text-brand-foreground"
                          } disabled:opacity-50`}
                        >
                          {checked ? "Remove" : "Assign"}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {filteredGeos.length > GEO_PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                    <span>
                      {(geoPage - 1) * GEO_PAGE_SIZE + 1}–{Math.min(geoPage * GEO_PAGE_SIZE, filteredGeos.length)} of {filteredGeos.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGeoPage((p) => Math.max(1, p - 1))}
                        disabled={geoPage <= 1}
                        className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors"
                      >
                        Prev
                      </button>
                      <span className="px-1 font-mono text-[11px]">
                        {geoPage} / {totalGeoPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setGeoPage((p) => Math.min(totalGeoPages, p + 1))}
                        disabled={geoPage >= totalGeoPages}
                        className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
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