import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  MapPin,
  Save,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/**
 * Trip allowance matrix: rows = geofence work locations, columns = positions.
 * Each cell is the nightly allowance rate for that position at that location.
 */
export function TripAllowancesTab() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [cells, setCells] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["trip-allowance-matrix"],
    queryFn: async () => {
      const [locs, poss, pols] = await Promise.all([
        supabase.from("geofence_locations").select("id, name, lat, lng, radius_m, active").order("name"),
        supabase.from("positions").select("id, name_en, name_ar, active").order("name_en"),
        (supabase as any).from("trip_allowance_policies")
          .select("id, geofence_location_id, position_id, nightly_rate")
          .not("geofence_location_id", "is", null),
      ]);
      if (locs.error) throw new Error(locs.error.message);
      if (poss.error) throw new Error(poss.error.message);
      if (pols.error) {
        if (/geofence_location_id|position_id/.test(pols.error.message)) {
          throw new Error("Database update needed: run docs/migrations/054-trip-allowance-positions-geofence.sql");
        }
        throw new Error(pols.error.message);
      }
      return {
        locations: (locs.data ?? []).filter((l: any) => l.active !== false),
        positions: (poss.data ?? []).filter((p: any) => p.active !== false),
        policies: (pols.data ?? []) as Array<{ id: string; geofence_location_id: string; position_id: string; nightly_rate: number }>,
      };
    },
  });

  const key = (l: string, p: string) => `${l}:${p}`;

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const p of data.policies) next[key(p.geofence_location_id, p.position_id)] = String(p.nightly_rate ?? "");
    setCells(next);
  }, [data]);

  const original = useMemo(() => {
    const m: Record<string, { id: string; rate: string }> = {};
    for (const p of data?.policies ?? []) m[key(p.geofence_location_id, p.position_id)] = { id: p.id, rate: String(p.nightly_rate ?? "") };
    return m;
  }, [data]);

  const dirtyKeys = Object.keys({ ...cells, ...original }).filter(
    (k) => (cells[k] ?? "") !== (original[k]?.rate ?? ""),
  );

  const save = useMutation({
    mutationFn: async () => {
      const posName = new Map((data?.positions ?? []).map((p: any) => [p.id, p.name_en]));
      const toDelete: string[] = [];
      const toUpsert: any[] = [];
      for (const k of dirtyKeys) {
        const [locId, posId] = k.split(":");
        const raw = (cells[k] ?? "").trim();
        const existing = original[k];
        if (raw === "") {
          if (existing) toDelete.push(existing.id);
          continue;
        }
        const rate = Number(raw);
        if (!Number.isFinite(rate) || rate < 0) throw new Error("Rates must be 0 or more");
        toUpsert.push({
          ...(existing ? { id: existing.id } : {}),
          geofence_location_id: locId,
          position_id: posId,
          job_grade: posName.get(posId) ?? "position",
          nightly_rate: rate,
        });
      }
      if (toDelete.length) {
        const { error } = await supabase.from("trip_allowance_policies").delete().in("id", toDelete);
        if (error) throw new Error(error.message);
      }
      if (toUpsert.length) {
        const { error } = await (supabase as any).from("trip_allowance_policies").upsert(toUpsert);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Trip allowances saved");
      qc.invalidateQueries({ queryKey: ["trip-allowance-matrix"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const locations = useMemo(() => {
    return (data?.locations ?? []).filter((l: any) =>
      !term.trim() || l.name.toLowerCase().includes(term.trim().toLowerCase()),
    );
  }, [data?.locations, term]);

  const [showAll, setShowAll] = useState(false);
  const DEFAULTS = ["driver", "engineer", "technician", "technitian", "manager", "supervisor"];
  const allPositions = data?.positions ?? [];
  const defaultPositions = allPositions.filter((p: any) => DEFAULTS.includes(String(p.name_en ?? "").trim().toLowerCase()));
  const positions = showAll || defaultPositions.length === 0 ? allPositions : defaultPositions;

  const totalItems = locations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedLocations = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return locations.slice(start, start + pageSize);
  }, [locations, safePage, pageSize]);

  function getPaginationRange(current: number, total: number) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, "...", total];
    if (current >= total - 2) return [1, "...", total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Trip Allowances Policy</h2>
          <p className="text-sm text-muted-foreground">
            <button type="button" className="mr-2 underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show main positions only" : "Show all positions"}
            </button>
            Nightly allowance per position for each work location. Locations come from Geofencing (Work Locations).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search location…"
              className="h-9 w-56 rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={dirtyKeys.length === 0 || save.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save{dirtyKeys.length ? ` (${dirtyKeys.length})` : ""}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{(error as Error).message}</p>
      ) : locations.length === 0 ? (
        <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
          {term ? `No locations matching "${term}".` : "No work locations yet. Add them on the Work Locations (Geofencing) page."}
        </p>
      ) : positions.length === 0 ? (
        <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">No positions yet. Add them in Directory → Positions.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/50 px-3.5 py-2.5 text-start font-semibold w-56 sm:w-64 max-w-[260px] border-r border-border/50">
                    Work location
                  </th>
                  {positions.map((p: any) => (
                    <th key={p.id} className="px-3.5 py-2.5 text-start font-semibold whitespace-nowrap w-36 min-w-[120px]">
                      {p.name_en}
                    </th>
                  ))}
                  <th className="w-auto" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedLocations.map((l: any) => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-card px-3.5 py-2.5 w-56 sm:w-64 max-w-[260px] border-r border-border/50">
                      <p className="flex items-center gap-1.5 font-medium truncate" title={l.name}>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                        <span className="truncate">{l.name}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground ps-5">radius {l.radius_m} m</p>
                    </td>
                    {positions.map((p: any) => {
                      const k = key(l.id, p.id);
                      const dirty = (cells[k] ?? "") !== (original[k]?.rate ?? "");
                      return (
                        <td key={p.id} className="px-3 py-2 w-36">
                          <input
                            type="number"
                            min={0}
                            value={cells[k] ?? ""}
                            placeholder="—"
                            onChange={(e) => setCells({ ...cells, [k]: e.target.value })}
                            className={`h-8 w-24 rounded-lg border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring ${dirty ? "border-brand" : "border-input"}`}
                          />
                        </td>
                      );
                    })}
                    <td className="w-auto" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!isLoading && totalItems > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="hidden sm:inline">
                  Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} of {totalItems} locations
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="me-2 font-medium text-foreground sm:inline hidden">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={safePage <= 1}
                    title="First Page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    title="Previous Page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="hidden items-center gap-1 sm:flex">
                    {getPaginationRange(safePage, totalPages).map((p, idx) =>
                      typeof p === "number" ? (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${
                            p === safePage
                              ? "bg-foreground text-background shadow-sm"
                              : "border border-border bg-card text-foreground hover:bg-muted"
                          }`}
                        >
                          {p}
                        </button>
                      ) : (
                        <span key={idx} className="px-1 text-muted-foreground select-none">
                          …
                        </span>
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    title="Next Page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    disabled={safePage >= totalPages}
                    title="Last Page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Leave a cell empty for no allowance. Rates are per night (EGP).</p>
    </div>
  );
}
