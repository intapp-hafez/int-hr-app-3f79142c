import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Star, Trash2, Search, Loader2 } from "lucide-react";
import { LeafletMap } from "@/components/LeafletMap";
import {
  listEmployeeWorkLocations,
  saveEmployeeWorkLocation,
  removeEmployeeWorkLocation,
} from "@/backend/functions/geofencing.functions";

export const Route = createFileRoute("/admin/work-locations")({
  component: WorkLocationsPage,
  head: () => ({
    meta: [
      { title: "Work Locations · HR Admin" },
      { name: "description", content: "Assign each employee a default work location and an allowed check-in radius." },
      { property: "og:title", content: "Work Locations · HR Admin" },
      { property: "og:description", content: "Assign default work locations and per-employee check-in radius." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function WorkLocationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmployeeWorkLocations);
  const saveFn = useServerFn(saveEmployeeWorkLocation);
  const removeFn = useServerFn(removeEmployeeWorkLocation);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "work-locations"],
    queryFn: () => listFn(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "work-locations"] });

  const saveMut = useMutation({
    mutationFn: (v: { profileId: string; locationId: string; radius_m?: number | null; makeDefault?: boolean }) =>
      saveFn({ data: v }),
    onSuccess: () => { toast.success("Saved"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const removeMut = useMutation({
    mutationFn: (v: { profileId: string; locationId: string }) => removeFn({ data: v }),
    onSuccess: () => { toast.success("Removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove"),
  });

  const locations = data?.locations ?? [];
  const employees = data?.employees ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.emp_code ?? "").toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q),
    );
  }, [employees, search]);

  const active = employees.find((e) => e.id === selected) ?? null;

  const markers = useMemo(() => {
    if (active) {
      return active.assignments.map((a) => ({
        id: a.location_id,
        name: `${a.name}${a.is_default ? " ★" : ""}`,
        lat: a.lat,
        lng: a.lng,
        radius: a.radius_m ?? a.location_radius_m,
        active: true,
      }));
    }
    return locations.map((l) => ({ id: l.id, name: l.name, lat: l.lat, lng: l.lng, radius: l.radius_m, active: l.active }));
  }, [active, locations]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Work Locations</h1>
        <p className="text-sm text-muted-foreground">
          Assign each employee their approved work locations, a default location, and the allowed check-in radius.
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-3">
        <LeafletMap
          markers={markers}
          selectedId={active?.assignments.find((a) => a.is_default)?.location_id}
          height={340}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {active ? `Approved areas for ${active.full_name}` : "All approved work areas · pick an employee to focus"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees…"
              className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <div className="max-h-[520px] space-y-1 overflow-y-auto">
            {isLoading ? (
              <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    selected === e.id ? "bg-gradient-brand text-brand-foreground" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="block font-medium">{e.full_name}</span>
                  <span className="block text-xs opacity-70">
                    {e.emp_code ?? "—"} · {e.department ?? "No department"} · {e.assignments.length} location
                    {e.assignments.length === 1 ? "" : "s"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          {!active ? (
            <p className="text-sm text-muted-foreground">Select an employee to manage their work locations.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">{active.full_name}</h2>
                <p className="text-xs text-muted-foreground">{active.department ?? "No department"}</p>
              </div>

              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2">Location</th>
                    <th className="py-2">Allowed radius (m)</th>
                    <th className="py-2">Default</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {active.assignments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-muted-foreground">
                        No work location assigned yet — check-ins are not restricted by location.
                      </td>
                    </tr>
                  )}
                  {active.assignments.map((a) => (
                    <tr key={a.location_id} className="border-t border-border">
                      <td className="py-2 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-brand" /> {a.name}
                        </span>
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={10}
                          max={10000}
                          defaultValue={a.radius_m ?? ""}
                          placeholder={`${a.location_radius_m} default`}
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const next = raw === "" ? null : Number(raw);
                            if (next !== (a.radius_m ?? null)) {
                              saveMut.mutate({ profileId: active.id, locationId: a.location_id, radius_m: next });
                            }
                          }}
                          className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-sm tabular-nums"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() =>
                            saveMut.mutate({ profileId: active.id, locationId: a.location_id, makeDefault: true })
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                            a.is_default ? "bg-brand/10 text-brand" : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Star className={`h-3.5 w-3.5 ${a.is_default ? "fill-current" : ""}`} />
                          {a.is_default ? "Default" : "Make default"}
                        </button>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => removeMut.mutate({ profileId: active.id, locationId: a.location_id })}
                          className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                          aria-label="Remove location"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="text-xs font-medium text-muted-foreground">Add location</span>
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    saveMut.mutate({ profileId: active.id, locationId: e.target.value });
                  }}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a work location…</option>
                  {locations
                    .filter((l) => !active.assignments.some((a) => a.location_id === l.id))
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} · {l.radius_m}m
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
