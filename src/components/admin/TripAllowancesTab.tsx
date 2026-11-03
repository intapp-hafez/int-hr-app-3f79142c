import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { rateCells } from "@/lib/shared-settings-sync";
import { useI18n } from "@/lib/i18n";
import { resolveLocationCityAndDistrict } from "@/components/admin/GeofenceLocationsTable";
import {
  Loader2,
  MapPin,
  Save,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Check,
  Building2,
  X,
} from "lucide-react";

/**
 * Trip allowance matrix: rows = geofence work locations, columns = positions.
 * Each cell is the nightly allowance rate for that position at that location.
 * Supports grouping by City with batch-rate assignment per city group.
 */
export function TripAllowancesTab() {
  const qc = useQueryClient();
  const { lang, isAr } = useI18n();
  const [term, setTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [groupByCity, setGroupByCity] = useState<boolean>(true);
  const [collapsedCities, setCollapsedCities] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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

  const cells = useMemo(() => rateCells(data?.policies ?? [], drafts), [data?.policies, drafts]);

  const original = useMemo(() => {
    const m: Record<string, { id: string; rate: string }> = {};
    for (const p of data?.policies ?? []) m[key(p.geofence_location_id, p.position_id)] = { id: p.id, rate: String(p.nightly_rate ?? "") };
    return m;
  }, [data]);

  const dirtyKeys = Object.keys({ ...cells, ...original }).filter(
    (k) => (cells[k] ?? "") !== (original[k]?.rate ?? ""),
  );

  const save = useMutation({
    mutationFn: async (changes: Record<string, string>) => {
      const posName = new Map((data?.positions ?? []).map((p: any) => [p.id, p.name_en]));
      const toDelete: string[] = [];
      const toUpsert: any[] = [];
      for (const k of Object.keys(changes)) {
        const [locId, posId] = k.split(":");
        const raw = changes[k].trim();
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
        const { error } = await (supabase as any).from("trip_allowance_policies").delete().in("id", toDelete);
        if (error) throw new Error(error.message);
      }
      if (toUpsert.length) {
        const { error } = await (supabase as any).from("trip_allowance_policies").upsert(toUpsert);
        if (error) throw new Error(error.message);
      }
      return changes;
    },
    onSuccess: (saved) => {
      setDrafts((current) => {
        const next = { ...current };
        for (const k of Object.keys(saved)) if (next[k] === saved[k]) delete next[k];
        return next;
      });
      toast.success("Trip allowances saved");
      qc.invalidateQueries({ queryKey: ["trip-allowance-matrix"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Map each location to its resolved city and district
  const locationCityMap = useMemo(() => {
    const map = new Map<string, { city: string; district: string }>();
    for (const l of data?.locations ?? []) {
      const resolved = resolveLocationCityAndDistrict(l, undefined, isAr);
      const city = resolved.city?.trim() || (isAr ? "مدن أخرى" : "Other Cities");
      map.set(l.id, { city, district: resolved.district || "" });
    }
    return map;
  }, [data?.locations, isAr]);

  // Unique cities list with counts
  const uniqueCities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of data?.locations ?? []) {
      const info = locationCityMap.get(l.id);
      const city = info?.city || (isAr ? "مدن أخرى" : "Other Cities");
      counts.set(city, (counts.get(city) || 0) + 1);
    }
    const otherLabel = isAr ? "مدن أخرى" : "Other Cities";
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (a.name === otherLabel) return 1;
        if (b.name === otherLabel) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [data?.locations, locationCityMap, isAr]);

  // Filtered locations by search query and city selection
  const filteredLocations = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (data?.locations ?? []).filter((l: any) => {
      const info = locationCityMap.get(l.id);
      const city = info?.city || "";
      const district = info?.district || "";

      if (selectedCity !== "all" && city.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }

      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        city.toLowerCase().includes(q) ||
        district.toLowerCase().includes(q)
      );
    });
  }, [data?.locations, locationCityMap, selectedCity, term]);

  const DEFAULTS = ["driver", "engineer", "technician", "technitian", "manager", "supervisor"];
  const allPositions = data?.positions ?? [];
  const defaultPositions = allPositions.filter((p: any) => DEFAULTS.includes(String(p.name_en ?? "").trim().toLowerCase()));

  const EXTRA_KEY = "trip-allowance-extra-positions";
  const [extraIds, setExtraIds] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem(EXTRA_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x: any) => typeof x === "string") : []; } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(EXTRA_KEY, JSON.stringify(extraIds)); } catch { /* ignore */ }
  }, [extraIds]);

  const positions = useMemo(() => {
    const base = defaultPositions.length === 0 ? allPositions : defaultPositions;
    const seen = new Set(base.map((p: any) => p.id));
    const extra = extraIds
      .map((id) => allPositions.find((p: any) => p.id === id))
      .filter((p: any) => p && !seen.has(p.id));
    return [...base, ...extra];
  }, [allPositions, defaultPositions, extraIds]);

  const addablePositions = allPositions.filter((p: any) => !positions.some((v: any) => v.id === p.id));
  function addPosition(id: string) {
    if (!id) return;
    setExtraIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }
  function removePosition(id: string) {
    setExtraIds((prev) => prev.filter((x) => x !== id));
  }

  const totalItems = filteredLocations.length;
  const isAllPages = pageSize === 9999;
  const totalPages = isAllPages ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = isAllPages ? 1 : Math.min(Math.max(1, page), totalPages);

  const paginatedLocations = useMemo(() => {
    if (isAllPages) return filteredLocations;
    const start = (safePage - 1) * pageSize;
    return filteredLocations.slice(start, start + pageSize);
  }, [filteredLocations, safePage, pageSize, isAllPages]);

  // Group the visible locations by city
  const cityGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const l of paginatedLocations) {
      const info = locationCityMap.get(l.id);
      const city = info?.city || (isAr ? "مدن أخرى" : "Other Cities");
      if (!map.has(city)) map.set(city, []);
      map.get(city)!.push(l);
    }
    const otherLabel = isAr ? "مدن أخرى" : "Other Cities";
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === otherLabel) return 1;
      if (b === otherLabel) return -1;
      return a.localeCompare(b);
    });
  }, [paginatedLocations, locationCityMap, isAr]);

  // Batch apply rate to all locations in a city for a given position
  function applyCityRate(city: string, posId: string, rateValue: string) {
    const trimmed = rateValue.trim();
    // Find all locations belonging to this city in the entire filtered list
    const targetLocs = filteredLocations.filter((l: any) => {
      const info = locationCityMap.get(l.id);
      return (info?.city || (isAr ? "مدن أخرى" : "Other Cities")) === city;
    });

    if (targetLocs.length === 0) return;

    setDrafts((current) => {
      const next = { ...current };
      for (const loc of targetLocs) {
        const k = key(loc.id, posId);
        if (trimmed === (original[k]?.rate ?? "")) {
          delete next[k];
        } else {
          next[k] = trimmed;
        }
      }
      return next;
    });

    const pos = positions.find((p: any) => p.id === posId);
    const posName = isAr && pos?.name_ar ? pos.name_ar : pos?.name_en || "position";
    if (trimmed === "") {
      toast.success(isAr ? `تم إفراغ بدل ${posName} لكافة مواقع ${city}` : `Cleared ${posName} rate for all ${targetLocs.length} locations in ${city}`);
    } else {
      toast.success(isAr ? `تم تطبيق ${trimmed} ج.م لبدل ${posName} على كافة مواقع ${city}` : `Applied ${trimmed} EGP for ${posName} across all ${targetLocs.length} locations in ${city}`);
    }
  }

  function toggleCityCollapse(city: string) {
    setCollapsedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  const allVisibleCities = cityGroups.map(([c]) => c);
  const allCollapsed = allVisibleCities.length > 0 && allVisibleCities.every((c) => collapsedCities.has(c));

  function toggleAllCollapse() {
    if (allCollapsed) {
      setCollapsedCities(new Set());
    } else {
      setCollapsedCities(new Set(allVisibleCities));
    }
  }

  function getPaginationRange(current: number, total: number) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, "...", total];
    if (current >= total - 2) return [1, "...", total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Action Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold">{isAr ? "سياسة بدلات السفر والبدلات الليلية" : "Trip Allowances Policy"}</h2>
            {addablePositions.length > 0 && (
              <select
                value=""
                onChange={(e) => addPosition(e.target.value)}
                className="h-7 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                <option value="">{isAr ? "+ إضافة مسمى وظيفي…" : "+ Add position…"}</option>
                {addablePositions.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {isAr && p.name_ar ? p.name_ar : p.name_en}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "البدل الليلي لكل مسمى وظيفي حسب موقع العمل. يتم تجميع المواقع حسب المدينة لتسهيل الإدارة."
              : "Nightly allowance per position for each work location. Locations are grouped by city for easy policy management."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* City Filter Selector */}
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by city"
              className="h-9 rounded-xl border border-border bg-card px-3 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-ring cursor-pointer shadow-2xs font-medium"
            >
              <option value="all">
                {isAr ? `كافة المدن (${uniqueCities.length})` : `All Cities (${uniqueCities.length})`}
              </option>
              {uniqueCities.map(({ name, count }) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Grouping Toggle */}
          <button
            type="button"
            onClick={() => setGroupByCity((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs sm:text-sm font-medium transition-all shadow-2xs ${
              groupByCity
                ? "border-brand/40 bg-brand/10 text-brand dark:text-orange-400 font-semibold"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={groupByCity ? "Switch to flat list" : "Group locations by city"}
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">{groupByCity ? (isAr ? "مجمّع بالمدن" : "Grouped by City") : (isAr ? "قائمة متصلة" : "Flat List")}</span>
          </button>

          {/* Expand/Collapse All when grouped */}
          {groupByCity && cityGroups.length > 1 && (
            <button
              type="button"
              onClick={toggleAllCollapse}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-card px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground shadow-2xs transition-colors"
              title={allCollapsed ? "Expand all cities" : "Collapse all cities"}
            >
              {allCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              <span className="hidden md:inline">{allCollapsed ? (isAr ? "فتح الكل" : "Expand All") : (isAr ? "طي الكل" : "Collapse All")}</span>
            </button>
          )}

          {/* Search Location / City */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setPage(1);
              }}
              placeholder={isAr ? "بحث بالموقع أو المدينة…" : "Search location or city…"}
              className="h-9 w-48 sm:w-56 rounded-xl border border-border bg-card pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {term && (
              <button
                type="button"
                onClick={() => {
                  setTerm("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={() => save.mutate(Object.fromEntries(dirtyKeys.map((k) => [k, cells[k] ?? ""])))}
            disabled={dirtyKeys.length === 0 || save.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-50 transition-transform active:scale-95"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isAr ? "حفظ" : "Save"}
            {dirtyKeys.length ? ` (${dirtyKeys.length})` : ""}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {isAr ? "جاري التحميل…" : "Loading…"}</p>
      ) : error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{(error as Error).message}</p>
      ) : filteredLocations.length === 0 ? (
        <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
          {term || selectedCity !== "all"
            ? (isAr ? "لا توجد مواقع مطابقة للبحث أو المدينة المحددة." : "No locations matching the current filter or search.")
            : (isAr ? "لا توجد مواقع عمل. يرجى إضافتها من صفحة المواقع الجغرافية." : "No work locations yet. Add them on the Work Locations (Geofencing) page.")}
        </p>
      ) : positions.length === 0 ? (
        <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">{isAr ? "لا توجد مسميات وظيفية بعد." : "No positions yet. Add them in Directory → Positions."}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="sticky left-0 z-20 bg-muted/95 dark:bg-[#181a24]/95 backdrop-blur px-3.5 py-2.5 text-start font-semibold w-64 sm:w-72 max-w-[280px] border-r border-border/60">
                    {isAr ? "موقع العمل" : "Work location"}
                  </th>
                  {positions.map((p: any) => (
                    <th key={p.id} className="px-3.5 py-2.5 text-start font-semibold whitespace-nowrap w-36 min-w-[120px]">
                      <span className="inline-flex items-center gap-1">
                        {isAr && p.name_ar ? p.name_ar : p.name_en}
                        {extraIds.includes(p.id) && (
                          <button
                            type="button"
                            title="Remove this column"
                            onClick={() => removePosition(p.id)}
                            className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="w-auto" />
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {groupByCity ? (
                  // Grouped by City Rendering
                  cityGroups.map(([city, cityLocs]) => {
                    const isCollapsed = collapsedCities.has(city);
                    return (
                      <Fragment key={city}>
                        {/* City Section Header Row */}
                        <tr className="bg-muted/75 dark:bg-[#14161f] border-y-2 border-border/80 transition-colors">
                          <td className="sticky left-0 z-10 bg-muted/90 dark:bg-[#14161f] px-3.5 py-2.5 w-64 sm:w-72 max-w-[280px] border-r border-border/60">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => toggleCityCollapse(city)}
                                className="flex items-center gap-2 font-bold text-foreground text-xs sm:text-sm text-start hover:text-brand transition-colors group"
                              >
                                <div className="grid h-6 w-6 place-items-center rounded-lg bg-brand/15 text-brand dark:text-orange-400 group-hover:scale-105 transition-transform">
                                  <Building2 className="h-3.5 w-3.5" />
                                </div>
                                <span className="truncate">{city}</span>
                                <span className="inline-flex items-center rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  {cityLocs.length}
                                </span>
                                {isCollapsed ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Quick Set Row per City Group */}
                          {positions.map((p: any) => {
                            const inputId = `batch-${city.replace(/[^a-zA-Z0-9]/g, "-")}-${p.id}`;
                            return (
                              <td key={p.id} className="px-3 py-1.5 w-36">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder={isAr ? "تحديد للكل…" : "Set city…"}
                                    title={`Set all ${cityLocs.length} locations in ${city} for ${p.name_en}`}
                                    id={inputId}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const el = e.currentTarget;
                                        applyCityRate(city, p.id, el.value);
                                        el.value = "";
                                      }
                                    }}
                                    className="h-7 w-20 rounded-md border border-border/80 bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-brand placeholder:text-muted-foreground/60 shadow-2xs font-mono"
                                  />
                                  <button
                                    type="button"
                                    title={`Apply to all locations in ${city}`}
                                    onClick={() => {
                                      const el = document.getElementById(inputId) as HTMLInputElement | null;
                                      if (el) {
                                        applyCityRate(city, p.id, el.value);
                                        el.value = "";
                                      }
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-md border border-border/80 bg-card hover:bg-brand hover:text-white text-muted-foreground transition-all shadow-2xs active:scale-95"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                          <td className="w-auto" />
                        </tr>

                        {/* Location Rows under this City */}
                        {!isCollapsed &&
                          cityLocs.map((l: any) => (
                            <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                              <td className="sticky left-0 z-10 bg-card px-3.5 py-2.5 w-64 sm:w-72 max-w-[280px] border-r border-border/50 ps-6">
                                <p className="flex items-center gap-1.5 font-medium truncate" title={l.name}>
                                  <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                                  <span className="truncate">{l.name}</span>
                                </p>
                                <p className="text-[11px] text-muted-foreground ps-3">radius {l.radius_m} m</p>
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
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setDrafts((current) => {
                                          const next = { ...current };
                                          if (value === (original[k]?.rate ?? "")) delete next[k];
                                          else next[k] = value;
                                          return next;
                                        });
                                      }}
                                      className={`h-8 w-24 rounded-lg border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring ${
                                        dirty ? "border-brand ring-1 ring-brand/30 font-semibold text-brand dark:text-orange-400" : "border-input"
                                      }`}
                                    />
                                  </td>
                                );
                              })}
                              <td className="w-auto" />
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })
                ) : (
                  // Flat List Rendering
                  paginatedLocations.map((l: any) => {
                    const info = locationCityMap.get(l.id);
                    return (
                      <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                        <td className="sticky left-0 z-10 bg-card px-3.5 py-2.5 w-64 sm:w-72 max-w-[280px] border-r border-border/50">
                          <p className="flex items-center gap-1.5 font-medium truncate" title={l.name}>
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                            <span className="truncate">{l.name}</span>
                          </p>
                          <div className="flex items-center gap-2 ps-5 text-[11px] text-muted-foreground">
                            <span>radius {l.radius_m} m</span>
                            {info?.city && (
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-foreground">
                                {info.city}
                              </span>
                            )}
                          </div>
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
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setDrafts((current) => {
                                    const next = { ...current };
                                    if (value === (original[k]?.rate ?? "")) delete next[k];
                                    else next[k] = value;
                                    return next;
                                  });
                                }}
                                className={`h-8 w-24 rounded-lg border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring ${
                                  dirty ? "border-brand ring-1 ring-brand/30 font-semibold text-brand dark:text-orange-400" : "border-input"
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="w-auto" />
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!isLoading && totalItems > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{isAr ? "عدد الصفوف:" : "Rows per page:"}</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={9999}>{isAr ? "الكل" : "All"}</option>
                </select>
                <span className="hidden sm:inline">
                  {isAllPages
                    ? (isAr ? `عرض كافة الـ ${totalItems} موقع` : `Showing all ${totalItems} locations across ${cityGroups.length} cities`)
                    : (isAr
                        ? `عرض ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalItems)} من إجمالي ${totalItems} موقع`
                        : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalItems)} of ${totalItems} locations`)}
                </span>
              </div>

              {!isAllPages && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="me-2 font-medium text-foreground sm:inline hidden">
                    {isAr ? `صفحة ${safePage} من ${totalPages}` : `Page ${safePage} of ${totalPages}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={safePage <= 1}
                    title="First Page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsLeft className="h-4 w-4 rtl-flip" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    title="Previous Page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 rtl-flip" />
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
                    <ChevronRight className="h-4 w-4 rtl-flip" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    disabled={safePage >= totalPages}
                    title="Last Page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsRight className="h-4 w-4 rtl-flip" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "اترك الخلية فارغة لعدم احتساب بدل. البدلات بالجنيه المصري (EGP) لكل ليلة سفر. يمكنك استخدام خيار 'تحديد للكل' لتطبيق بدل سريع لكافة مواقع المدينة."
          : "Leave a cell empty for no allowance. Rates are per night (EGP). Use 'Set city…' in any city header to quick-fill all locations in that city."}
      </p>
    </div>
  );
}
