import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin, Save, Search } from "lucide-react";

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

  const locations = (data?.locations ?? []).filter((l: any) =>
    !term.trim() || l.name.toLowerCase().includes(term.trim().toLowerCase()),
  );
  const positions = data?.positions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Trip Allowances Policy</h2>
          <p className="text-sm text-muted-foreground">
            Nightly allowance per position for each work location. Locations come from Geofencing (Work Locations).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
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
          No work locations yet. Add them on the Work Locations (Geofencing) page.
        </p>
      ) : positions.length === 0 ? (
        <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">No positions yet. Add them in Directory → Positions.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-muted/50 px-3 py-2 text-start font-semibold">Work location</th>
                {positions.map((p: any) => (
                  <th key={p.id} className="px-3 py-2 text-start font-semibold whitespace-nowrap">{p.name_en}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {locations.map((l: any) => (
                <tr key={l.id}>
                  <td className="sticky left-0 bg-card px-3 py-2">
                    <p className="inline-flex items-center gap-1.5 font-medium"><MapPin className="h-3.5 w-3.5 text-brand" />{l.name}</p>
                    <p className="text-[11px] text-muted-foreground">radius {l.radius_m} m</p>
                  </td>
                  {positions.map((p: any) => {
                    const k = key(l.id, p.id);
                    const dirty = (cells[k] ?? "") !== (original[k]?.rate ?? "");
                    return (
                      <td key={p.id} className="px-2 py-2">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Leave a cell empty for no allowance. Rates are per night (EGP).</p>
    </div>
  );
}
