import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Users, Building2, Activity, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { getAdminMapData } from "@/backend/functions/map-data.functions";
import { EGYPT_CENTER, lookupCity } from "@/lib/egypt-cities";

const LeafletMap = lazy(() => import("./LeafletMapInner"));

type Layer = "employees" | "geofences" | "checkins";

export function EgyptMap() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ employees: true, geofences: true, checkins: true });
  const mapDataFn = useServerFn(getAdminMapData);

  useEffect(() => setMounted(true), []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-map-data"],
    queryFn: () => mapDataFn(),
    staleTime: 60_000,
    enabled: mounted && open,
  });

  const employeePoints = useMemo(() => {
    return (data?.employeeCities ?? [])
      .map((c) => ({ ...c, centroid: lookupCity(c.city) }))
      .filter((c): c is { city: string; count: number; centroid: NonNullable<ReturnType<typeof lookupCity>> } => c.centroid != null);
  }, [data]);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Egypt overview</h2>
          <span className="text-xs text-muted-foreground">
            {data ? `${employeePoints.length} cities · ${data.geofences.length} sites · ${data.checkins.length} check-ins (7d)` : isLoading ? "Loading…" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <div className="hidden items-center gap-1 sm:flex">
              <LayerToggle active={layers.employees} onClick={() => setLayers((l) => ({ ...l, employees: !l.employees }))} icon={Users} label="Employees" color="bg-primary" />
              <LayerToggle active={layers.geofences} onClick={() => setLayers((l) => ({ ...l, geofences: !l.geofences }))} icon={Building2} label="Sites" color="bg-success" />
              <LayerToggle active={layers.checkins} onClick={() => setLayers((l) => ({ ...l, checkins: !l.checkins }))} icon={Activity} label="Check-ins" color="bg-warning" />
            </div>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
            aria-expanded={open}
          >
            {open ? (<><ChevronUp className="h-3.5 w-3.5" /> Hide</>) : (<><ChevronDown className="h-3.5 w-3.5" /> Show map</>)}
          </button>
        </div>
      </header>
      {open && (
        <div className="relative h-[340px] w-full border-t border-border bg-muted/30">
          {!mounted || isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
            </div>
          ) : (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…</div>}>
              <LeafletMap
                employees={layers.employees ? employeePoints : []}
                geofences={layers.geofences ? data?.geofences ?? [] : []}
                checkins={layers.checkins ? data?.checkins ?? [] : []}
              />
            </Suspense>
          )}
        </div>
      )}
    </section>
  );
}

function LayerToggle({ active, onClick, icon: Icon, label, color }: { active: boolean; onClick: () => void; icon: any; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${active ? color : "bg-muted-foreground/40"}`} />
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}