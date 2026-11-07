import { useState, useMemo, useEffect, useRef } from "react";
import {
  Compass,
  MapPin,
  Search,
  X,
  Check,
  ChevronDown,
  Sparkles,
  Building2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveLocationCityAndDistrict } from "@/components/admin/GeofenceLocationsTable";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";

export interface SelectedTripLocationPayload {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  city?: string;
  district?: string;
  cityId?: string;
  districtId?: string;
}

interface TripAllowanceLocationPickerProps {
  selectedLocationId?: string;
  cityName?: string;
  districtName?: string;
  lat?: number;
  lng?: number;
  radius_m?: number;
  onSelectLocation: (payload: SelectedTripLocationPayload) => void;
  onClearLocation: () => void;
  dbCities: Array<{ id: string; name_en: string; name_ar?: string }>;
  dbDistricts: Array<{ id: string; city_id: string; name_en: string; name_ar?: string }>;
  isAr: boolean;
}

export function TripAllowanceLocationPicker({
  selectedLocationId,
  cityName,
  districtName,
  lat,
  lng,
  radius_m,
  onSelectLocation,
  onClearLocation,
  dbCities,
  dbDistricts,
  isAr,
}: TripAllowanceLocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "policy">("all");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Query active geofence locations
  const { data: tripLocations = [], isLoading: isLoadingLocs } = useQuery({
    queryKey: ["trip-allowance-work-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geofence_locations")
        .select("id, name, lat, lng, radius_m, active")
        .eq("active", true)
        .order("name");
      if (error) {
        console.warn("Failed to fetch geofence locations:", error.message);
        return [];
      }
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  // Query trip allowance policies to highlight locations with explicit policies
  const { data: tripPolicies = [] } = useQuery({
    queryKey: ["trip-allowance-policies-brief"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("trip_allowance_policies")
        .select("geofence_location_id, nightly_rate")
        .not("geofence_location_id", "is", null);
      if (error) return [];
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const policyLocationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of tripPolicies as any[]) {
      if (p.geofence_location_id) ids.add(p.geofence_location_id);
    }
    return ids;
  }, [tripPolicies]);

  // Current selected location object
  const selectedLoc = useMemo(() => {
    if (!selectedLocationId) return null;
    return tripLocations.find((l: any) => l.id === selectedLocationId) ?? null;
  }, [tripLocations, selectedLocationId]);

  // Filtered locations for dropdown display
  const filteredLocations = useMemo(() => {
    let list = tripLocations;
    if (filterMode === "policy" && policyLocationIds.size > 0) {
      list = list.filter((l: any) => policyLocationIds.has(l.id));
    }
    const q = search.trim().toLowerCase();
    if (!q) {
      return list.slice(0, 60);
    }
    return list
      .filter((loc: any) => {
        if (loc.name && loc.name.toLowerCase().includes(q)) return true;
        const geo = resolveLocationCityAndDistrict(loc, dbCities, isAr);
        if (geo.city && geo.city.toLowerCase().includes(q)) return true;
        if (geo.district && geo.district.toLowerCase().includes(q)) return true;
        return false;
      })
      .slice(0, 100);
  }, [tripLocations, filterMode, policyLocationIds, search, dbCities, isAr]);

  function handleSelect(loc: any) {
    const geo = resolveLocationCityAndDistrict(loc, dbCities, isAr);
    let matchedCityId = "";
    let matchedCityName = geo.city || "";
    let matchedDistrictId = "";
    let matchedDistrictName = geo.district || "";

    if (geo.city) {
      const normC = geo.city.toLowerCase().trim();
      const foundC = dbCities.find(
        (c: any) =>
          (c.name_en && c.name_en.toLowerCase().trim() === normC) ||
          (c.name_ar && c.name_ar.toLowerCase().trim() === normC) ||
          normC.includes((c.name_en || "").toLowerCase().trim()) ||
          normC.includes((c.name_ar || "").toLowerCase().trim())
      );
      if (foundC) {
        matchedCityId = foundC.id;
        matchedCityName = isAr
          ? foundC.name_ar || foundC.name_en
          : foundC.name_en || foundC.name_ar;
      }
    }

    if (geo.district) {
      const normD = geo.district.toLowerCase().trim();
      const foundD = dbDistricts.find(
        (d: any) =>
          (!matchedCityId || d.city_id === matchedCityId) &&
          ((d.name_en && d.name_en.toLowerCase().trim() === normD) ||
            (d.name_ar && d.name_ar.toLowerCase().trim() === normD) ||
            normD.includes((d.name_en || "").toLowerCase().trim()) ||
            normD.includes((d.name_ar || "").toLowerCase().trim()))
      );
      if (foundD) {
        matchedDistrictId = foundD.id;
        matchedDistrictName = isAr
          ? foundD.name_ar || foundD.name_en
          : foundD.name_en || foundD.name_ar;
        if (!matchedCityId && foundD.city_id) {
          matchedCityId = foundD.city_id;
          const parentC = dbCities.find((c: any) => c.id === foundD.city_id);
          if (parentC) {
            matchedCityName = isAr
              ? parentC.name_ar || parentC.name_en
              : parentC.name_en || parentC.name_ar;
          }
        }
      }
    }

    onSelectLocation({
      id: loc.id,
      name: loc.name,
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      radius_m: Number(loc.radius_m) || 200,
      city: matchedCityName,
      district: matchedDistrictName,
      cityId: matchedCityId,
      districtId: matchedDistrictId,
    });

    setIsOpen(false);
    setSearch("");

    // Fallback: asynchronous reverse geocode if city/district could not be derived from name
    if ((!matchedCityName || !matchedDistrictName) && loc.lat != null && loc.lng != null) {
      reverseGeocodeCoords(loc.lat, loc.lng, isAr ? "ar" : "en")
        .then((res) => {
          if (!res) return;
          let nextCityId = matchedCityId;
          let nextCity = matchedCityName || res.city;
          let nextDistrictId = matchedDistrictId;
          let nextDistrict = matchedDistrictName || res.district;

          if (!nextCityId && res.city) {
            const norm = res.city.toLowerCase().trim();
            const found = dbCities.find(
              (c: any) =>
                (c.name_en && c.name_en.toLowerCase().trim() === norm) ||
                (c.name_ar && c.name_ar.toLowerCase().trim() === norm) ||
                norm.includes((c.name_en || "").toLowerCase().trim()) ||
                norm.includes((c.name_ar || "").toLowerCase().trim())
            );
            if (found) {
              nextCityId = found.id;
              nextCity = isAr ? found.name_ar || found.name_en : found.name_en || found.name_ar;
            }
          }

          if (!nextDistrictId && res.district) {
            const norm = res.district.toLowerCase().trim();
            const found = dbDistricts.find(
              (d: any) =>
                (!nextCityId || d.city_id === nextCityId) &&
                ((d.name_en && d.name_en.toLowerCase().trim() === norm) ||
                  (d.name_ar && d.name_ar.toLowerCase().trim() === norm) ||
                  norm.includes((d.name_en || "").toLowerCase().trim()) ||
                  norm.includes((d.name_ar || "").toLowerCase().trim()))
            );
            if (found) {
              nextDistrictId = found.id;
              nextDistrict = isAr ? found.name_ar || found.name_en : found.name_en || found.name_ar;
              if (!nextCityId && found.city_id) {
                nextCityId = found.city_id;
                const parentC = dbCities.find((c: any) => c.id === found.city_id);
                if (parentC) {
                  nextCity = isAr
                    ? parentC.name_ar || parentC.name_en
                    : parentC.name_en || parentC.name_ar;
                }
              }
            }
          }

          onSelectLocation({
            id: loc.id,
            name: loc.name,
            lat: Number(loc.lat),
            lng: Number(loc.lng),
            radius_m: Number(loc.radius_m) || 200,
            city: nextCity,
            district: nextDistrict,
            cityId: nextCityId,
            districtId: nextDistrictId,
          });
        })
        .catch(() => {});
    }
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="block font-semibold text-foreground text-xs flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-brand" />
          <span>{isAr ? "موقع بدل السفر / موقع عمل معتمد" : "Trip Allowance Work Location"}</span>
        </label>
        {selectedLoc ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            {isAr ? "موقع معتمد لبدل السفر" : "Verified Trip Site"}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            {isAr ? "اختياري — تحديد تلقائي للموقع والإحداثيات" : "Optional — auto-fills coords & address"}
          </span>
        )}
      </div>

      <div className="relative">
        {selectedLoc ? (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 transition-all shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                  <span className="truncate">{selectedLoc.name}</span>
                  {policyLocationIds.has(selectedLoc.id) && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                      <Sparkles className="h-2.5 w-2.5" />
                      {isAr ? "بدل سفر" : "Allowance"}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {cityName && <span className="font-medium text-foreground/80">{cityName}</span>}
                  {districtName && <span> · {districtName}</span>}
                  <span className="font-mono text-muted-foreground/90">
                    {" "}
                    · {Number(selectedLoc.lat).toFixed(4)}, {Number(selectedLoc.lng).toFixed(4)} (
                    {selectedLoc.radius_m || 200}m)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen((o) => !o)}
                className="px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10 rounded-lg transition-colors"
              >
                {isAr ? "تغيير" : "Change"}
              </button>
              <button
                type="button"
                title={isAr ? "إلغاء التحديد وتخصيص يدوي" : "Clear and enter manual location"}
                onClick={onClearLocation}
                className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-input bg-background hover:bg-muted/40 text-xs font-medium text-start transition-all"
          >
            <span className="text-muted-foreground flex items-center gap-2 truncate">
              {isLoadingLocs ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              ) : (
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              )}
              <span className="truncate">
                {isLoadingLocs
                  ? isAr
                    ? "جاري تحميل مواقع العمل…"
                    : "Loading work locations…"
                  : isAr
                  ? "— اختر من مواقع بدل السفر ومواقع العمل المعتمدة —"
                  : "— Select Trip Allowance / Work Site —"}
              </span>
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        )}

        {/* Floating Dropdown Popover */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl p-2.5 space-y-2 max-w-full">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isAr
                    ? "ابحث باسم الموقع أو المدينة أو الحي..."
                    : "Search location by name, city, or district..."
                }
                className="w-full rounded-xl border border-input bg-background ps-8 pe-8 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-brand/30"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute end-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Mode Pills */}
            <div className="flex items-center gap-1.5 px-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-2.5 py-0.5 rounded-full font-medium transition-all ${
                  filterMode === "all"
                    ? "bg-brand text-brand-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {isAr ? `كل المواقع (${tripLocations.length})` : `All Sites (${tripLocations.length})`}
              </button>
              {policyLocationIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode("policy")}
                  className={`px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 transition-all ${
                    filterMode === "policy"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  {isAr
                    ? `مواقع ببدل محدد (${policyLocationIds.size})`
                    : `Designated Policies (${policyLocationIds.size})`}
                </button>
              )}
            </div>

            {/* Scrollable Location List */}
            <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-border/20 pe-1">
              {filteredLocations.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  {isAr ? "لم يتم العثور على مواقع مطابقة" : "No matching work locations found"}
                </div>
              ) : (
                filteredLocations.map((loc: any) => {
                  const isSelected = selectedLocationId === loc.id;
                  const hasPolicy = policyLocationIds.has(loc.id);
                  const locGeo = resolveLocationCityAndDistrict(loc, dbCities, isAr);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleSelect(loc)}
                      className={`w-full text-start p-2 rounded-xl transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-brand/10 text-brand font-semibold"
                          : "hover:bg-muted/70 text-foreground"
                      }`}
                    >
                      <div className="min-w-0 flex items-start gap-2">
                        <MapPin
                          className={`h-4 w-4 mt-0.5 shrink-0 ${
                            isSelected ? "text-brand" : "text-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs truncate font-medium flex items-center gap-1.5">
                            <span className="truncate">{loc.name}</span>
                            {hasPolicy && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                {isAr ? "بدل سفر" : "Allowance"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {locGeo.city && <span>{locGeo.city}</span>}
                            {locGeo.district && <span> · {locGeo.district}</span>}
                            <span> · {loc.radius_m || 200}m</span>
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-brand shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

