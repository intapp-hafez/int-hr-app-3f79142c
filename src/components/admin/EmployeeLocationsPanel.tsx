import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  MapPin,
  Plus,
  Trash2,
  Search,
  Check,
  X,
  Pencil,
  Copy,
  ExternalLink,
  Loader2,
  AlertCircle,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  listGeofenceAssignmentsForEmployee,
  setEmployeeGeofenceAssignment,
  listAllGeofences,
} from "@/backend/functions/network-assignments.functions";

interface EmployeeLocationsPanelProps {
  profileId: string;
  canManage?: boolean;
  employeeName?: string | null;
}

export function EmployeeLocationsPanel({
  profileId,
  canManage = true,
  employeeName,
}: EmployeeLocationsPanelProps) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const listEmpGeosFn = useServerFn(listGeofenceAssignmentsForEmployee);
  const toggleGeoFn = useServerFn(setEmployeeGeofenceAssignment);
  const listAllGeosFn = useServerFn(listAllGeofences);

  const queryKey = ["access", "emp-geos", profileId] as const;

  // Assigned locations query
  const { data: assignedLocations = [], isLoading: isLoadingAssigned } = useQuery({
    queryKey,
    queryFn: () => listEmpGeosFn({ data: { profileId } }),
    enabled: !!profileId,
  });

  // All geofence locations query
  const { data: allLocations = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ["access", "all-geofences"],
    queryFn: () => listAllGeosFn(),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Toggle or update radius mutation
  const toggleMut = useMutation({
    mutationFn: (vars: { locationId: string; assign: boolean; radius_m?: number | null }) =>
      toggleGeoFn({ data: { profileId, ...vars } }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.assign
          ? vars.radius_m !== undefined
            ? "Location radius updated"
            : "Location assigned successfully"
          : "Location removed from employee",
      );
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Operation failed"),
  });

  const assignedSet = useMemo(
    () => new Set(assignedLocations.map((l: any) => l.id)),
    [assignedLocations],
  );

  const unassignedLocations = useMemo(
    () => allLocations.filter((l: any) => !assignedSet.has(l.id)),
    [allLocations, assignedSet],
  );

  const filteredAssigned = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    if (!s) return assignedLocations;
    return assignedLocations.filter(
      (loc: any) =>
        (loc.name ?? "").toLowerCase().includes(s) ||
        String(loc.lat).includes(s) ||
        String(loc.lng).includes(s),
    );
  }, [assignedLocations, searchQuery]);

  const handleCopyCoords = (loc: any) => {
    const text = `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
    navigator.clipboard.writeText(text);
    setCopiedId(loc.id);
    toast.success("Coordinates copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                Assigned Locations
              </h2>
              <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                {assignedLocations.length}{" "}
                {assignedLocations.length === 1 ? "Location" : "Locations"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground max-w-xl">
              Geofence perimeters and authorized check-in locations for this employee. When locations are assigned, the employee is restricted to checking in within these authorized zones.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsAssignModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Assign Location</span>
          </button>
        )}
      </div>

      {/* Search & Stats Bar */}
      {assignedLocations.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assigned locations by name or coordinates..."
              className="w-full rounded-xl border border-input bg-background pl-9 pr-8 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Showing {filteredAssigned.length} of {assignedLocations.length} assigned
            </span>
          </div>
        </div>
      )}

      {/* Content Body */}
      {isLoadingAssigned ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" />
          <p className="mt-2 text-xs text-muted-foreground font-medium">
            Loading assigned locations...
          </p>
        </div>
      ) : assignedLocations.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 p-10 text-center my-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand mb-3">
            <Compass className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            No locations assigned to this employee
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            This employee does not currently have specific geofence locations assigned. Check-in access follows organization-wide access rules.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              Assign First Location
            </button>
          )}
        </div>
      ) : filteredAssigned.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-8 text-center">
          <p className="text-xs text-muted-foreground">
            No assigned locations match <span className="font-semibold text-foreground">"{searchQuery}"</span>
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-2 text-xs font-semibold text-brand hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        /* Assigned Locations List */
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredAssigned.map((loc: any) => (
            <AssignedLocationCard
              key={loc.id}
              loc={loc}
              canManage={canManage}
              isPending={toggleMut.isPending}
              isCopied={copiedId === loc.id}
              onCopyCoords={() => handleCopyCoords(loc)}
              onRemove={() => toggleMut.mutate({ locationId: loc.id, assign: false })}
              onUpdateRadius={(radius_m) =>
                toggleMut.mutate({ locationId: loc.id, assign: true, radius_m })
              }
            />
          ))}
        </div>
      )}

      {/* Assign Location Modal */}
      {isAssignModalOpen && (
        <AssignLocationModal
          employeeName={employeeName}
          unassignedLocations={unassignedLocations}
          isLoading={isLoadingAll}
          isPending={toggleMut.isPending}
          onClose={() => setIsAssignModalOpen(false)}
          onAssign={(locationId, radius_m) => {
            toggleMut.mutate(
              { locationId, assign: true, radius_m },
              {
                onSuccess: () => {
                  setIsAssignModalOpen(false);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}

function AssignedLocationCard({
  loc,
  canManage,
  isPending,
  isCopied,
  onCopyCoords,
  onRemove,
  onUpdateRadius,
}: {
  loc: any;
  canManage: boolean;
  isPending: boolean;
  isCopied: boolean;
  onCopyCoords: () => void;
  onRemove: () => void;
  onUpdateRadius: (radius: number | null) => void;
}) {
  const [isEditingRadius, setIsEditingRadius] = useState(false);
  const [radiusVal, setRadiusVal] = useState<string>(
    loc.override_radius_m != null ? String(loc.override_radius_m) : "",
  );

  const hasOverride = loc.override_radius_m != null;
  const googleMapsUrl = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

  const handleSaveRadius = () => {
    const trimmed = radiusVal.trim();
    const num = trimmed ? parseInt(trimmed, 10) : null;
    if (num !== (loc.override_radius_m ?? null)) {
      onUpdateRadius(num && !isNaN(num) && num > 0 ? num : null);
    }
    setIsEditingRadius(false);
  };

  return (
    <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-brand/30 hover:shadow-md transition-all flex flex-col justify-between gap-3">
      <div>
        {/* Top: Location Name & Active Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                loc.active
                  ? "bg-brand/10 text-brand"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate">
                {loc.name}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {loc.radius_m}m default zone perimeter
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              loc.active
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                loc.active ? "bg-emerald-500" : "bg-muted-foreground"
              }`}
            />
            {loc.active ? "Active" : "Off"}
          </span>
        </div>

        {/* Coordinates bar */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted/40 p-2 text-xs">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span>
              {loc.lat?.toFixed(5)}, {loc.lng?.toFixed(5)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCopyCoords}
              title="Copy GPS coordinates"
              className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Google Maps"
              className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom: Radius setting & Remove button */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        {/* Radius configuration */}
        <div className="flex items-center gap-1.5">
          {!isEditingRadius ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium border ${
                  hasOverride
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {hasOverride
                  ? `Custom: ${loc.override_radius_m}m`
                  : `Default: ${loc.radius_m}m`}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsEditingRadius(true)}
                  title="Edit custom radius override for this employee"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
              <input
                type="number"
                min={10}
                max={10000}
                step={10}
                autoFocus
                placeholder={`${loc.radius_m}`}
                value={radiusVal}
                onChange={(e) => setRadiusVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRadius();
                  if (e.key === "Escape") setIsEditingRadius(false);
                }}
                className="w-16 rounded border border-input bg-background px-1.5 py-0.5 text-xs font-mono text-end"
              />
              <span className="text-[10px] text-muted-foreground font-mono">m</span>
              <button
                type="button"
                onClick={handleSaveRadius}
                className="rounded p-1 text-emerald-600 hover:bg-emerald-500/10"
                title="Save radius override"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingRadius(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Remove Button */}
        {canManage && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (confirm(`Remove "${loc.name}" from this employee?`)) {
                onRemove();
              }
            }}
            title="Unassign this location"
            className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 hover:border-destructive/30 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            <span>Remove</span>
          </button>
        )}
      </div>
    </div>
  );
}

function AssignLocationModal({
  employeeName,
  unassignedLocations,
  isLoading,
  isPending,
  onClose,
  onAssign,
}: {
  employeeName?: string | null;
  unassignedLocations: any[];
  isLoading: boolean;
  isPending: boolean;
  onClose: () => void;
  onAssign: (locationId: string, radius_m?: number | null) => void;
}) {
  const [q, setQ] = useState("");
  const [selectedRadiusMap, setSelectedRadiusMap] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return unassignedLocations;
    return unassignedLocations.filter(
      (l) =>
        (l.name ?? "").toLowerCase().includes(s) ||
        String(l.lat).includes(s) ||
        String(l.lng).includes(s),
    );
  }, [unassignedLocations, q]);

  const handleAssignClick = (loc: any) => {
    const val = selectedRadiusMap[loc.id]?.trim();
    const num = val ? parseInt(val, 10) : null;
    onAssign(loc.id, num && !isNaN(num) && num > 0 ? num : null);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="border-b border-border/80 bg-muted/30 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Assign Location
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select a geofence location to authorize for{" "}
                  <span className="font-semibold text-foreground">
                    {employeeName || "this employee"}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search available locations by name..."
              className="w-full rounded-xl border border-input bg-background pl-9 pr-8 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Locations List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
              <p className="mt-2 text-xs text-muted-foreground">Loading locations...</p>
            </div>
          ) : unassignedLocations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <h4 className="text-sm font-bold text-foreground">
                All locations are already assigned
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                This employee has been assigned to all available geofence locations in the system.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center">
              <p className="text-xs text-muted-foreground">
                No locations found matching <span className="font-semibold text-foreground">"{q}"</span>
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {filtered.map((loc) => (
                <li
                  key={loc.id}
                  className="rounded-xl border border-border bg-card p-3 shadow-sm hover:border-brand/40 transition-colors flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        loc.active
                          ? "bg-brand/10 text-brand"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {loc.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            loc.active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {loc.active ? "Active" : "Off"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {loc.radius_m}m radius · {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* Assign controls */}
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <input
                        type="number"
                        min={10}
                        max={10000}
                        step={10}
                        placeholder={`${loc.radius_m}m`}
                        value={selectedRadiusMap[loc.id] || ""}
                        onChange={(e) =>
                          setSelectedRadiusMap((prev) => ({
                            ...prev,
                            [loc.id]: e.target.value,
                          }))
                        }
                        className="w-16 rounded border border-input bg-background px-1.5 py-1 text-xs font-mono text-end placeholder:text-muted-foreground/60"
                        title="Optional custom radius override"
                      />
                      <span className="font-mono text-[10px]">m</span>
                    </div>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAssignClick(loc)}
                      className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition-opacity disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Assign</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/80 bg-muted/20 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{unassignedLocations.length} available locations</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
