import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin,
  Plus,
  Users,
  X,
  Trash2,
  Loader2,
  Layers,
  KeyRound,
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileText,
  Search,
  Globe,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { LeafletMap } from "@/components/LeafletMap";
import { lookupCity } from "@/lib/egypt-cities";

import { listCitiesWithDistricts } from "@/backend/functions/directory.functions";
import {
  listGeofencesAdmin,
  createGeofenceAdmin,
  bulkCreateGeofencesAdmin,
  updateGeofenceAdmin,
  deleteGeofenceAdmin,
  listAssignableEmployees,
  toggleGeofenceAssignment,
  updateGeofenceAssignmentRadius,
  bulkAssignGeofences,
  listAllAssignableEmployees,
  type GeofenceLocation,
  type AssignableEmployee,
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
  const [importOpen, setImportOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<GeofenceLocation | null>(null);
  const [editFor, setEditFor] = useState<GeofenceLocation | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [showEgyptOverview, setShowEgyptOverview] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const selected = locations.find((l) => l.id === selectedId) ?? null;

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; name?: string; lat?: number; lng?: number; radius_m?: number; active?: boolean }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Updated");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const mapMarkers = useMemo(() => {
    return locations.map((l) => ({
      id: l.id,
      name: l.name,
      lat: l.lat,
      lng: l.lng,
      radius: l.radius_m,
      active: l.active,
    }));
  }, [locations]);

  const filteredLocations = useMemo(() => {
    let list = locations;
    if (filterStatus === "active") list = list.filter((l) => l.active);
    if (filterStatus === "inactive") list = list.filter((l) => !l.active);
    const s = searchQuery.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (l) =>
        l.name.toLowerCase().includes(s) ||
        String(l.lat).includes(s) ||
        String(l.lng).includes(s),
    );
  }, [locations, filterStatus, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("geofencing")}</h1>
            <span className="rounded-full bg-brand/10 text-brand px-2.5 py-0.5 text-xs font-semibold">
              {locations.length} {locations.length === 1 ? "zone" : "zones"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t("approvedZones")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowEgyptOverview((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm transition-colors ${
              showEgyptOverview ? "bg-muted text-foreground font-medium" : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            <Globe className="h-4 w-4" /> {showEgyptOverview ? "Hide Egypt overview" : "Egypt overview"}
          </button>
          <Link
            to="/admin/employee-access"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-foreground hover:bg-muted"
          >
            <KeyRound className="h-4 w-4" /> {t("employeeAccess")}
          </Link>
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
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {t("importExcel")}
          </button>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand"
          >
            <Plus className="h-4 w-4" /> {t("addLocation")}
          </button>
        </div>
      </div>

      {/* Optional macro Egypt overview */}
      {showEgyptOverview && (
        <Suspense fallback={<div className="h-[420px] rounded-3xl border border-border bg-card" />}>
          <EgyptMap />
        </Suspense>
      )}

      {/* Main split view: Map on the left, Locations on the right */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left column: Interactive Map */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-2 lg:sticky lg:top-4">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm flex flex-col">
            {/* Map bar */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {selected ? selected.name : "Geofence Zones Map"}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">
                    {selected
                      ? `${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)} · ${selected.radius_m}m radius`
                      : "Click any zone on map or list to focus"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground border border-border">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {locations.filter((l) => l.active).length} Active
                </span>
                {selected && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditFor(selected)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                      title="Edit location details"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" /> Edit
                    </button>
                    <button
                      onClick={() => setAssignFor(selected)}
                      className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-[11px] font-semibold text-brand-foreground shadow-brand"
                    >
                      <Users className="h-3 w-3" /> {t("assignEmployees")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Map Container */}
            <div className="h-[540px] xl:h-[620px] w-full relative">
              <LeafletMap
                height="100%"
                markers={mapMarkers}
                selectedId={selectedId ?? undefined}
                editableId={selectedId ?? undefined}
                onSelect={(id) => setSelectedId(String(id))}
                onRadiusChange={(id, r) => updateMut.mutate({ id: String(id), radius_m: r })}
              />
            </div>

            {/* Map bottom helper */}
            <div className="border-t border-border bg-muted/20 px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Drag the orange handle on selected zone to resize radius</span>
              {selected && (
                <span className="font-medium text-foreground">
                  {selected.assigned_count} {t("employees")} assigned
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Locations List */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-3">
          {/* Search & Filter Card */}
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-sm font-semibold">Locations</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {filteredLocations.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    filterStatus === "all" ? "bg-brand text-brand-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus("active")}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    filterStatus === "active" ? "bg-brand text-brand-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilterStatus("inactive")}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    filterStatus === "inactive" ? "bg-brand text-brand-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  Off
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search locations by name…"
                className="w-full rounded-xl border border-input bg-background py-1.5 ps-8 pe-7 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* List items */}
          <ul className="space-y-2 max-h-[calc(100vh-280px)] min-h-[460px] overflow-y-auto pr-1">
            {isLoading && (
              <li className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…
              </li>
            )}
            {!isLoading && filteredLocations.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground space-y-2">
                <p>No locations match your search.</p>
                <button
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("addLocation")}
                </button>
              </li>
            )}
            {filteredLocations.map((l) => {
              const assigned = l.assigned_count;
              const isActive = l.id === selectedId;
              return (
                <li
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={`cursor-pointer rounded-2xl border bg-card p-3.5 transition-all ${
                    isActive
                      ? "border-brand shadow-sm ring-1 ring-brand bg-brand/5 dark:bg-brand/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                        isActive ? "bg-brand text-brand-foreground" : "bg-accent text-accent-foreground"
                      }`}>
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm truncate">{l.name}</p>
                          {isActive && (
                            <span className="rounded-full bg-brand/15 text-brand px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {l.lat.toFixed(4)}, {l.lng.toFixed(4)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {assigned} · {t("employees")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* ON/OFF Switch Button */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={l.active}
                          title={l.active ? "Turn Off" : "Turn On"}
                          onClick={() => updateMut.mutate({ id: l.id, active: !l.active })}
                          disabled={updateMut.isPending}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                            l.active ? "bg-success" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              l.active ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <span className={`text-[10px] font-semibold uppercase ${l.active ? "text-success" : "text-muted-foreground"}`}>
                          {l.active ? t("active") : t("off")}
                        </span>
                      </div>

                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditFor(l);
                        }}
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Edit location"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete ${l.name}?`)) deleteMut.mutate(l.id);
                        }}
                        className="rounded-full p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Radius slider & number input */}
                  <div className="mt-2.5 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">{t("radius")}</span>
                      <span className="font-mono font-semibold tabular-nums text-xs">{l.radius_m} m</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={500}
                      step={10}
                      value={l.radius_m}
                      onChange={(e) => updateMut.mutate({ id: l.id, radius_m: Number(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1.5 w-full accent-brand cursor-pointer"
                    />
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(l.id);
                        setAssignFor(l);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1 text-xs font-semibold text-brand-foreground shadow-brand"
                    >
                      <Users className="h-3 w-3" /> {t("assignEmployees")}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditFor(l);
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-border text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" /> Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(l.id);
                        }}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                          isActive ? "border-brand/40 text-brand bg-brand/10" : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <MapPin className="h-3 w-3" /> Focus
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {adding && (
        <AddLocationModal
          onClose={() => setAdding(false)}
          onCreated={invalidate}
          onOpenImport={() => setImportOpen(true)}
        />
      )}
      {editFor && (
        <EditLocationModal
          location={editFor}
          onClose={() => setEditFor(null)}
          onUpdated={invalidate}
        />
      )}
      {importOpen && (
        <ImportLocationsModal
          onClose={() => setImportOpen(false)}
          onImported={invalidate}
        />
      )}
      {assignFor && <AssignEmployeesModal location={assignFor} onClose={() => setAssignFor(null)} onChanged={invalidate} />}
      {bulkOpen && <BulkAssignModal locations={locations} onClose={() => setBulkOpen(false)} onChanged={invalidate} />}
    </div>
  );
}

function EditLocationModal({
  location,
  onClose,
  onUpdated,
}: {
  location: GeofenceLocation;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useI18n();
  const updateFn = useServerFn(updateGeofenceAdmin);

  const [name, setName] = useState(location.name);
  const [lat, setLat] = useState(location.lat.toFixed(6));
  const [lng, setLng] = useState(location.lng.toFixed(6));
  const [radius, setRadius] = useState(location.radius_m);
  const [active, setActive] = useState(location.active);

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const validCoords = isFinite(latNum) && isFinite(lngNum);

  const mut = useMutation({
    mutationFn: (vars: { name: string; lat: number; lng: number; radius_m: number; active: boolean }) =>
      updateFn({ data: { id: location.id, ...vars } }),
    onSuccess: () => {
      toast.success("Location updated successfully");
      onUpdated();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update location"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    if (!validCoords) return toast.error("Valid coordinates required");
    mut.mutate({
      name: name.trim().slice(0, 80),
      lat: latNum,
      lng: lngNum,
      radius_m: radius,
      active,
    });
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-4 rounded-3xl bg-background p-6 shadow-soft max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
              <Pencil className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-semibold">Edit Location</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("locationName")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              placeholder="e.g. Cairo Headquarters"
            />
          </label>

          {/* Active status switch */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div>
              <p className="text-sm font-medium">Active status</p>
              <p className="text-xs text-muted-foreground">When off, employees cannot check in or out at this zone</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => setActive(!active)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out ${
                active ? "bg-success" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                  active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Interactive Map */}
          {validCoords && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <LeafletMap
                height={260}
                markers={[{ id: "preview", name: name || "Zone", lat: latNum, lng: lngNum, radius, active }]}
                selectedId="preview"
                editableId="preview"
                onMapClick={(la, lo) => {
                  setLat(la.toFixed(6));
                  setLng(lo.toFixed(6));
                }}
                onRadiusChange={(_id, r) => setRadius(r)}
              />
              <p className="border-t border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
                Click map to move pin · drag the orange handle to resize radius
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Lat</span>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Lng</span>
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
              {t("radius")}{" "}
              <span className="font-semibold text-foreground tabular-nums">{radius} m</span>
            </span>
            <input
              type="range"
              min={20}
              max={1000}
              step={10}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-brand cursor-pointer"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
            >
              {mut.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddLocationModal({
  onClose,
  onCreated,
  onOpenImport,
  initialLat,
  initialLng,
}: {
  onClose: () => void;
  onCreated: () => void;
  onOpenImport?: () => void;
  initialLat?: number;
  initialLng?: number;
}) {
  const { t, lang: language } = useI18n();
  const listCitiesFn = useServerFn(listCitiesWithDistricts);
  const { data: dbCities = [] } = useQuery({
    queryKey: ["admin", "cities-districts"],
    queryFn: () => listCitiesFn(),
  });

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [lat, setLat] = useState(initialLat != null ? initialLat.toFixed(6) : "30.044420");
  const [lng, setLng] = useState(initialLng != null ? initialLng.toFixed(6) : "31.235712");
  const [radius, setRadius] = useState(500);
  const createFn = useServerFn(createGeofenceAdmin);

  async function geocodeAndPan(placeName: string, contextName: string = "") {
    if (!placeName) return;
    const loc = lookupCity(placeName);
    if (loc) {
      setLat(loc.lat.toFixed(6));
      setLng(loc.lng.toFixed(6));
      return;
    }
    try {
      const q = encodeURIComponent(`${placeName}${contextName ? ", " + contextName : ""}, Egypt`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(Number(data[0].lat).toFixed(6));
        setLng(Number(data[0].lon).toFixed(6));
      }
    } catch (e) {
      console.warn("Geocoding failed", e);
    }
  }

  const selectedCity = dbCities.find(c => c.name_en === city || c.name_ar === city);
  const availableDistricts = selectedCity?.districts ?? [];

  useEffect(() => {
    if (city && availableDistricts.length > 0) {
      if (!availableDistricts.some(d => d.name_en === district || d.name_ar === district)) {
        setDistrict("");
      }
    } else if (city && availableDistricts.length === 0) {
      setDistrict("");
    }
  }, [city, availableDistricts, district]);
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
    const parts = [name.trim(), district.trim(), city.trim()].filter(Boolean);
    mut.mutate({ name: parts.join(" · ").slice(0, 60), lat: la, lng: lo, radius_m: radius });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const validCoords = isFinite(latNum) && isFinite(lngNum);

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-3xl bg-background p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("addLocation")}</h2>
            {onOpenImport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImport();
                }}
                className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> {t("importFromExcelTemplate")}
              </button>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">City</span>
            <select
              value={city}
              onChange={(e) => {
                const v = e.target.value;
                setCity(v);
                void geocodeAndPan(v);
              }}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            >
              <option value="">Select city...</option>
              {dbCities.map(c => (
                <option key={c.id} value={language === "ar" ? c.name_ar : c.name_en}>
                  {language === "ar" ? c.name_ar : c.name_en}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">District</span>
            <select
              value={district}
              onChange={(e) => {
                const v = e.target.value;
                setDistrict(v);
                if (v) void geocodeAndPan(v, city);
                else if (city) void geocodeAndPan(city);
              }}
              disabled={!city || availableDistricts.length === 0}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm disabled:opacity-50"
            >
              <option value="">Select district...</option>
              {availableDistricts.map(d => (
                <option key={d.id} value={language === "ar" ? d.name_ar : d.name_en}>
                  {language === "ar" ? d.name_ar : d.name_en}
                </option>
              ))}
            </select>
          </label>
        </div>
        {validCoords && (
          <div className="overflow-hidden rounded-2xl border border-border">
            <LeafletMap
              height={280}
              markers={[{ id: "new", name: name || "New location", lat: latNum, lng: lngNum, radius, active: true }]}
              selectedId="new"
              editableId="new"
              onMapClick={(la, lo) => { setLat(la.toFixed(6)); setLng(lo.toFixed(6)); }}
              onRadiusChange={(_id, r) => setRadius(r)}
            />
            <p className="border-t border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
              Tap the map to move the pin · drag the orange handle to resize
            </p>
          </div>
        )}
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

function AssigneeRow({
  e,
  location,
  onToggle,
  onRadiusChange,
  isPending,
}: {
  e: AssignableEmployee;
  location: GeofenceLocation;
  onToggle: (assign: boolean) => void;
  onRadiusChange: (radius: number | null) => void;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const [radiusVal, setRadiusVal] = useState<string>(e.radius_m != null ? String(e.radius_m) : "");

  useEffect(() => {
    setRadiusVal(e.radius_m != null ? String(e.radius_m) : "");
  }, [e.radius_m]);

  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{e.full_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {e.emp_code ?? "—"}
            {e.department ? ` · ${e.department}` : ""}
          </p>
        </div>
        <button
          disabled={isPending}
          onClick={() => onToggle(!e.assigned)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            e.assigned ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-gradient-brand text-brand-foreground"
          }`}
        >
          {e.assigned ? (
            <span className="inline-flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> {t("remove")}
            </span>
          ) : (
            t("add")
          )}
        </button>
      </div>

      {e.assigned && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60 text-xs">
          <span className="text-muted-foreground text-[11px]">Radius override:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={10}
              max={10000}
              step={10}
              placeholder={`${location.radius_m}m default`}
              value={radiusVal}
              onChange={(evt) => setRadiusVal(evt.target.value)}
              onBlur={() => {
                const trimmed = radiusVal.trim();
                const num = trimmed ? parseInt(trimmed, 10) : null;
                if (num !== (e.radius_m ?? null)) {
                  onRadiusChange(num && !isNaN(num) && num > 0 ? num : null);
                }
              }}
              onKeyDown={(evt) => {
                if (evt.key === "Enter") {
                  evt.currentTarget.blur();
                }
              }}
              className="w-28 rounded-lg border border-input bg-background px-2 py-1 text-xs font-mono text-end placeholder:text-muted-foreground/60"
            />
            <span className="text-[11px] text-muted-foreground">m</span>
          </div>
        </div>
      )}
    </li>
  );
}

function AssignEmployeesModal({ location, onClose, onChanged }: { location: GeofenceLocation; onClose: () => void; onChanged: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listAssignableEmployees);
  const toggleFn = useServerFn(toggleGeofenceAssignment);
  const updateRadiusFn = useServerFn(updateGeofenceAssignmentRadius);
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

  const radiusMut = useMutation({
    mutationFn: (vars: { profileId: string; radius_m: number | null }) =>
      updateRadiusFn({ data: { locationId: location.id, profileId: vars.profileId, radius_m: vars.radius_m } }),
    onSuccess: () => {
      toast.success("Radius updated");
      qc.invalidateQueries({ queryKey });
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update radius"),
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
        <p className="text-xs text-muted-foreground mb-3">
          Assign employees and customize their individual allowed check-in radius if different from the location default ({location.radius_m}m).
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="mb-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>}
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {filtered.map((e) => (
            <AssigneeRow
              key={e.id}
              e={e}
              location={location}
              isPending={mut.isPending || radiusMut.isPending}
              onToggle={(assign) => mut.mutate({ profileId: e.id, assign })}
              onRadiusChange={(radius_m) => radiusMut.mutate({ profileId: e.id, radius_m })}
            />
          ))}
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

type ParsedLocationRow = {
  rawIndex: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  active: boolean;
  city?: string;
  district?: string;
  isValid: boolean;
  error?: string;
};

function ImportLocationsModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedLocationRow[]>([]);
  const [filter, setFilter] = useState<"all" | "valid" | "invalid">("all");
  const [isDragging, setIsDragging] = useState(false);

  const bulkFn = useServerFn(bulkCreateGeofencesAdmin);

  const importMut = useMutation({
    mutationFn: (validList: { name: string; lat: number; lng: number; radius_m: number; active: boolean }[]) =>
      bulkFn({ data: { locations: validList } }),
    onSuccess: (res) => {
      toast.success(`Successfully imported ${res.count} locations!`);
      onImported();
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to import locations");
    },
  });

  async function handleDownloadTemplate() {
    try {
      const XLSX = await import("xlsx");
      const headers = ["Name", "Latitude", "Longitude", "Radius_m", "City", "District", "Active"];
      const sample = [
        {
          Name: "Cairo Headquarters",
          Latitude: 30.044420,
          Longitude: 31.235712,
          Radius_m: 100,
          City: "Cairo",
          District: "Downtown",
          Active: "Yes",
        },
        {
          Name: "Alexandria Branch",
          Latitude: 31.200092,
          Longitude: 29.918739,
          Radius_m: 150,
          City: "Alexandria",
          District: "Smouha",
          Active: "Yes",
        },
        {
          Name: "Giza Operations Hub",
          Latitude: 30.013056,
          Longitude: 31.208853,
          Radius_m: 120,
          City: "Giza",
          District: "Dokki",
          Active: "Yes",
        },
      ];
      const ws = XLSX.utils.json_to_sheet(sample, { header: headers });
      ws["!cols"] = [
        { wch: 28 }, // Name
        { wch: 14 }, // Latitude
        { wch: 14 }, // Longitude
        { wch: 12 }, // Radius_m
        { wch: 14 }, // City
        { wch: 14 }, // District
        { wch: 10 }, // Active
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Locations");
      XLSX.writeFile(wb, "locations_template.xlsx");
      toast.success("Excel template downloaded");
    } catch (err: any) {
      toast.error("Failed to generate template: " + (err?.message || ""));
    }
  }

  async function processFile(selectedFile: File) {
    setFile(selectedFile);
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("No sheet found in Excel workbook");
      }
      const ws = wb.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      if (!rawRows || rawRows.length === 0) {
        toast.error("The selected file is empty");
        setRows([]);
        setParsing(false);
        return;
      }

      const parsed: ParsedLocationRow[] = rawRows.map((r, idx) => {
        const getVal = (candidates: string[]) => {
          for (const key of Object.keys(r)) {
            const cleanKey = key.trim().toLowerCase();
            if (candidates.some((c) => c.toLowerCase() === cleanKey)) {
              return r[key];
            }
          }
          return undefined;
        };

        const rawName = String(getVal(["name", "location name", "location", "title", "اسم الموقع", "الاسم", "الموقع"]) ?? "").trim();
        const rawCity = String(getVal(["city", "المدينة"]) ?? "").trim();
        const rawDistrict = String(getVal(["district", "الحي", "المنطقة"]) ?? "").trim();

        let finalName = rawName;
        if (!finalName && (rawCity || rawDistrict)) {
          finalName = [rawCity, rawDistrict].filter(Boolean).join(" - ");
        }

        const rawLat = getVal(["latitude", "lat", "y", "خط العرض", "خط_العرض"]);
        const rawLng = getVal(["longitude", "lng", "lon", "long", "x", "خط الطول", "خط_الطول"]);
        const rawRadius = getVal(["radius_m", "radius", "radius (m)", "radius_meters", "نصف القطر", "نصف_القطر"]);
        const rawActive = getVal(["active", "status", "نشط", "الحالة"]);

        const latNum = typeof rawLat === "number" ? rawLat : parseFloat(String(rawLat ?? ""));
        const lngNum = typeof rawLng === "number" ? rawLng : parseFloat(String(rawLng ?? ""));

        let radiusNum = 100;
        if (rawRadius !== undefined && rawRadius !== null && rawRadius !== "") {
          const parsedRad = typeof rawRadius === "number" ? rawRadius : parseInt(String(rawRadius), 10);
          if (!isNaN(parsedRad) && parsedRad >= 10 && parsedRad <= 5000) {
            radiusNum = parsedRad;
          }
        }

        let activeVal = true;
        if (rawActive !== undefined && rawActive !== null && rawActive !== "") {
          if (typeof rawActive === "boolean") {
            activeVal = rawActive;
          } else {
            const s = String(rawActive).trim().toLowerCase();
            if (s === "false" || s === "no" || s === "0" || s === "غير نشط" || s === "معطل" || s === "لا") {
              activeVal = false;
            }
          }
        }

        let isValid = true;
        const errors: string[] = [];

        if (!finalName) {
          isValid = false;
          errors.push("Missing name");
        } else if (finalName.length > 80) {
          finalName = finalName.slice(0, 80);
        }

        if (isNaN(latNum) || latNum < -90 || latNum > 90) {
          isValid = false;
          errors.push("Invalid Lat (-90..90)");
        }

        if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
          isValid = false;
          errors.push("Invalid Lng (-180..180)");
        }

        return {
          rawIndex: idx + 1,
          name: finalName,
          lat: Number(isFinite(latNum) ? latNum.toFixed(6) : 0),
          lng: Number(isFinite(lngNum) ? lngNum.toFixed(6) : 0),
          radius_m: radiusNum,
          active: activeVal,
          city: rawCity || undefined,
          district: rawDistrict || undefined,
          isValid,
          error: errors.length > 0 ? errors.join(", ") : undefined,
        };
      });

      setRows(parsed);
    } catch (err: any) {
      toast.error("Failed to parse Excel file: " + (err?.message || ""));
      setRows([]);
    } finally {
      setParsing(false);
    }
  }

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);

  const displayedRows =
    filter === "valid" ? validRows : filter === "invalid" ? invalidRows : rows;

  function handleImport() {
    if (validRows.length === 0) {
      toast.error(t("noValidLocationsToImport"));
      return;
    }
    const payload = validRows.map((r) => ({
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      radius_m: r.radius_m,
      active: r.active,
    }));
    importMut.mutate(payload);
  }

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-background p-6 shadow-soft"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">{t("importFromExcelTemplate")}</h2>
              <p className="text-xs text-muted-foreground">{t("dragAndDropExcel")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {/* Action Row: Template Download & Upload Helper */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/80 bg-muted/30 p-3.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand" />
              <span className="text-xs font-medium text-foreground">
                Need the official format?
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted shadow-xs transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-brand" /> {t("downloadTemplate")} (.xlsx)
            </button>
          </div>

          {/* Upload Zone */}
          {!file && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) processFile(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? "border-brand bg-brand/5 scale-[0.99]"
                  : "border-border hover:border-brand/60 hover:bg-muted/30"
              }`}
            >
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Upload className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {t("dragAndDropExcel")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports .xlsx, .xls, .csv with columns (Name, Latitude, Longitude, Radius_m, Active)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processFile(f);
                }}
              />
            </div>
          )}

          {/* Parsing State */}
          {parsing && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-brand" />
              Reading & validating Excel rows…
            </div>
          )}

          {/* Results Table & Filter */}
          {!parsing && file && rows.length > 0 && (
            <div className="space-y-3">
              {/* File Info & Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setRows([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-brand hover:underline font-medium"
                  >
                    Change file
                  </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-card p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className={`rounded-full px-2.5 py-1 transition-colors ${
                      filter === "all" ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"
                    }`}
                  >
                    All ({rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("valid")}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                      filter === "valid"
                        ? "bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" /> {validRows.length} {t("validLocations")}
                  </button>
                  {invalidRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilter("invalid")}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                        filter === "invalid"
                          ? "bg-destructive/15 font-semibold text-destructive"
                          : "text-destructive"
                      }`}
                    >
                      <AlertCircle className="h-3 w-3" /> {invalidRows.length} {t("invalidLocations")}
                    </button>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="max-h-[38vh] overflow-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 backdrop-blur-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 w-10">#</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Location Name</th>
                      <th className="px-3 py-2">Coordinates</th>
                      <th className="px-3 py-2">Radius</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {displayedRows.map((r) => (
                      <tr
                        key={r.rawIndex}
                        className={!r.isValid ? "bg-destructive/5" : undefined}
                      >
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.rawIndex}</td>
                        <td className="px-3 py-2">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                              <AlertCircle className="h-3 w-3" /> Error
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {r.name || <span className="text-muted-foreground italic">—</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                        </td>
                        <td className="px-3 py-2">{r.radius_m}m</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              r.active ? "bg-emerald-500" : "bg-muted-foreground"
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.error ? (
                            <span className="text-destructive font-medium">{r.error}</span>
                          ) : (
                            "Ready to import"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
          >
            {t("cancel")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={validRows.length === 0 || importMut.isPending}
              onClick={handleImport}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-5 py-2 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
            >
              {importMut.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  {t("importLocations")} ({validRows.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

