import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Users, X, Trash2, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

import {
  listGeofencesAdmin,
  createGeofenceAdmin,
  updateGeofenceAdmin,
  deleteGeofenceAdmin,
  listAssignableEmployees,
  toggleGeofenceAssignment,
  bulkAssignGeofences,
  listAllAssignableEmployees,
  type GeofenceLocation,
} from "@/backend/functions/geofencing.functions";

const EgyptMap = lazy(() => import("@/components/admin/EgyptMap").then((mod) => ({ default: mod.EgyptMap })));

export const Route = createFileRoute("/admin/geofencing")({
  component: GeoPage,
});

function GeoPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listGeofencesAdmin);
  const updateFn = useServerFn(updateGeofenceAdmin);
  const deleteFn = useServerFn(deleteGeofenceAdmin);
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["admin", "geofences"],
    queryFn: () => listFn(),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "geofences"] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && locations[0]) setSelectedId(locations[0].id);
    if (selectedId && !locations.find((l) => l.id === selectedId)) setSelectedId(locations[0]?.id ?? null);
  }, [locations, selectedId]);
  const [adding, setAdding] = useState(false);
  const [assignFor, setAssignFor] = useState<GeofenceLocation | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const selected = locations.find((l) => l.id === selectedId) ?? null;

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; name?: string; lat?: number; lng?: number; radius_m?: number; active?: boolean }) =>
      updateFn({ data: vars }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-[420px] rounded-3xl border border-border bg-card" />}>
        <EgyptMap />
      </Suspense>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("geofencing")}</h1>
          <p className="text-sm text-muted-foreground">{t("approvedZones")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            disabled={locations.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm disabled:opacity-50"
          >
            <Layers className="h-4 w-4" /> Bulk assign
          </button>
          <button
            onClick={() => selected && setAssignFor(selected)}
            disabled={!selected}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm disabled:opacity-50"
          >
            <Users className="h-4 w-4" /> {t("assignEmployees")}
          </button>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand"
          >
            <Plus className="h-4 w-4" /> {t("addLocation")}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <ul className="space-y-2 lg:col-span-5">
          {isLoading && (
            <li className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…
            </li>
          )}
          {!isLoading && locations.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No locations yet. Add one to get started.
            </li>
          )}
          {locations.map((l) => {
            const assigned = l.assigned_count;
            const isActive = l.id === selectedId;
            return (
              <li
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className={`cursor-pointer rounded-2xl border bg-card p-4 transition-colors ${isActive ? "border-brand shadow-brand" : "border-border hover:bg-muted/50"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground"><MapPin className="h-4 w-4" /></span>
                    <div>
                      <p className="font-semibold">{l.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{l.lat.toFixed(4)}, {l.lng.toFixed(4)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{assigned} · {t("employees")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: l.id, active: !l.active }); }}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${l.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                    >
                      {l.active ? t("active") : t("off")}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${l.name}?`)) deleteMut.mutate(l.id); }}
                      className="rounded-full p-1.5 text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("radius")}</span>
                  <span className="font-semibold tabular-nums">{l.radius_m} m</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={500}
                  step={10}
                  value={l.radius_m}
                  onChange={(e) => updateMut.mutate({ id: l.id, radius_m: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 w-full accent-brand"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedId(l.id); setAssignFor(l); }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
                >
                  <Users className="h-3 w-3" /> {t("assignEmployees")}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {adding && <AddLocationModal onClose={() => setAdding(false)} onCreated={invalidate} />}
      {assignFor && <AssignEmployeesModal location={assignFor} onClose={() => setAssignFor(null)} onChanged={invalidate} />}
      {bulkOpen && <BulkAssignModal locations={locations} onClose={() => setBulkOpen(false)} onChanged={invalidate} />}
    </div>
  );
}

function AddLocationModal({ onClose, onCreated, initialLat, initialLng }: { onClose: () => void; onCreated: () => void; initialLat?: number; initialLng?: number }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [lat, setLat] = useState(initialLat != null ? initialLat.toFixed(6) : "24.7136");
  const [lng, setLng] = useState(initialLng != null ? initialLng.toFixed(6) : "46.6753");
  const [radius, setRadius] = useState(100);
  const createFn = useServerFn(createGeofenceAdmin);
  const mut = useMutation({
    mutationFn: (vars: { name: string; lat: number; lng: number; radius_m: number }) =>
      createFn({ data: { ...vars, active: true } }),
    onSuccess: () => { toast.success("Location added"); onCreated(); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    const la = parseFloat(lat), lo = parseFloat(lng);
    if (!isFinite(la) || !isFinite(lo)) return toast.error("Valid coordinates required");
    mut.mutate({ name: name.trim(), lat: la, lng: lo, radius_m: radius });
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-3xl bg-background p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("addLocation")}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">Lat</span>
            <input value={lat} onChange={(e) => setLat(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">Lng</span>
            <input value={lng} onChange={(e) => setLng(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm" /></label>
        </div>
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
            {t("radius")} <span className="font-semibold text-foreground tabular-nums">{radius} m</span>
          </span>
          <input type="range" min={20} max={500} step={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-brand" />
        </label>
        <button disabled={mut.isPending} className="w-full rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-50">
          {mut.isPending ? "…" : t("create")}
        </button>
      </form>
    </div>
  );
}

function AssignEmployeesModal({ location, onClose, onChanged }: { location: GeofenceLocation; onClose: () => void; onChanged: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listAssignableEmployees);
  const toggleFn = useServerFn(toggleGeofenceAssignment);
  const queryKey = ["admin", "geofences", "assignable", location.id] as const;
  const { data: employees = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { locationId: location.id } }),
  });
  const mut = useMutation({
    mutationFn: (vars: { profileId: string; assign: boolean }) =>
      toggleFn({ data: { locationId: location.id, ...vars } }),
    onSuccess: (_d, vars) => {
      toast.success(vars.assign ? "Assigned" : "Removed");
      qc.invalidateQueries({ queryKey });
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return employees;
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(s) ||
        (e.emp_code ?? "").toLowerCase().includes(s) ||
        (e.department ?? "").toLowerCase().includes(s),
    );
  }, [employees, q]);
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-6 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("assignEmployees")} — {location.name}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="mb-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>}
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
          {filtered.map((e) => {
            const assigned = e.assigned;
            return (
              <li key={e.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-medium">{e.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{e.emp_code ?? "—"}{e.department ? ` · ${e.department}` : ""}</p>
                </div>
                <button
                  disabled={mut.isPending}
                  onClick={() => mut.mutate({ profileId: e.id, assign: !assigned })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${assigned ? "bg-destructive/10 text-destructive" : "bg-gradient-brand text-brand-foreground"}`}
                >
                  {assigned ? <span className="inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> {t("remove")}</span> : t("add")}
                </button>
              </li>
            );
          })}
          {!isLoading && filtered.length === 0 && (
            <li className="py-6 text-center text-xs text-muted-foreground">No employees</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function BulkAssignModal({
  locations,
  onClose,
  onChanged,
}: {
  locations: GeofenceLocation[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const listFn = useServerFn(listAllAssignableEmployees);
  const bulkFn = useServerFn(bulkAssignGeofences);
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["admin", "geofences", "all-employees"],
    queryFn: () => listFn(),
  });
  const [locSel, setLocSel] = useState<Set<string>>(new Set());
  const [empSel, setEmpSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return employees;
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(s) ||
        (e.emp_code ?? "").toLowerCase().includes(s) ||
        (e.department ?? "").toLowerCase().includes(s),
    );
  }, [employees, q]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const mut = useMutation({
    mutationFn: (assign: boolean) =>
      bulkFn({ data: { locationIds: Array.from(locSel), profileIds: Array.from(empSel), assign } }),
    onSuccess: (_d, assign) => {
      toast.success(
        `${assign ? "Assigned" : "Removed"} ${empSel.size} employee(s) across ${locSel.size} location(s)`,
      );
      onChanged();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const canRun = locSel.size > 0 && empSel.size > 0 && !mut.isPending;

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl rounded-3xl bg-background p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Bulk assign employees</h2>
            <p className="text-xs text-muted-foreground">Pick locations and employees, then apply to all combinations.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Locations · {locSel.size}/{locations.length}</h3>
              <button
                onClick={() => setLocSel(locSel.size === locations.length ? new Set() : new Set(locations.map((l) => l.id)))}
                className="text-xs text-brand hover:underline"
              >
                {locSel.size === locations.length ? "Clear" : "Select all"}
              </button>
            </div>
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
              {locations.map((l) => {
                const checked = locSel.has(l.id);
                return (
                  <li
                    key={l.id}
                    onClick={() => toggle(locSel, setLocSel, l.id)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 text-sm ${checked ? "border-brand bg-brand/5" : "border-border hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={checked} readOnly className="accent-brand" />
                      <div>
                        <p className="font-medium">{l.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{l.radius_m}m · {l.assigned_count} assigned</p>
                      </div>
                    </div>
                    {!l.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">off</span>}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Employees · {empSel.size}/{filtered.length}</h3>
              <button
                onClick={() => setEmpSel(empSel.size === filtered.length ? new Set() : new Set(filtered.map((e) => e.id)))}
                className="text-xs text-brand hover:underline"
              >
                {empSel.size === filtered.length ? "Clear" : "Select all"}
              </button>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search")}
              className="mb-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>
            ) : (
              <ul className="max-h-[42vh] space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
                {filtered.map((e) => {
                  const checked = empSel.has(e.id);
                  return (
                    <li
                      key={e.id}
                      onClick={() => toggle(empSel, setEmpSel, e.id)}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm ${checked ? "border-brand bg-brand/5" : "border-border hover:bg-muted/50"}`}
                    >
                      <input type="checkbox" checked={checked} readOnly className="accent-brand" />
                      <div>
                        <p className="font-medium">{e.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{e.emp_code ?? "—"}{e.department ? ` · ${e.department}` : ""}</p>
                      </div>
                    </li>
                  );
                })}
                {filtered.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">No employees</li>}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Will affect {locSel.size * empSel.size} assignment{locSel.size * empSel.size === 1 ? "" : "s"}.
          </p>
          <div className="flex gap-2">
            <button
              disabled={!canRun}
              onClick={() => mut.mutate(false)}
              className="rounded-full border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-50"
            >
              Remove
            </button>
            <button
              disabled={!canRun}
              onClick={() => mut.mutate(true)}
              className="rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
            >
              {mut.isPending ? "Applying…" : "Assign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
