import { useEffect, useRef } from "react";

export type TrackingMapGeofence = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  count?: number;
  color?: string;
  active?: boolean;
};

export type TrackingMapEmployee = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  status: "on_site" | "in_office" | "in_transit" | "offline" | "breach";
  label?: string;
};

export type TrackingMapRoute = {
  coords: [number, number][];
  color?: string;
  dashed?: boolean;
  startLabel?: string;
  endLabel?: string;
  animatedPosition?: [number, number] | null;
};

type Props = {
  geofences?: TrackingMapGeofence[];
  employees?: TrackingMapEmployee[];
  route?: TrackingMapRoute;
  selectedId?: string | null;
  onSelectEmployee?: (id: string) => void;
  onSelectGeofence?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  height?: number | string;
  center?: [number, number];
  zoom?: number;
};

const STATUS_COLORS: Record<TrackingMapEmployee["status"], string> = {
  on_site: "#16a34a",
  in_office: "#16a34a",
  in_transit: "#ea580c",
  offline: "#64748b",
  breach: "#dc2626",
};

export function TrackingLeafletMap({
  geofences = [],
  employees = [],
  route,
  selectedId,
  onSelectEmployee,
  onSelectGeofence,
  onMapClick,
  height = 460,
  center,
  zoom = 12,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const onSelectEmpRef = useRef(onSelectEmployee);
  const onSelectGeoRef = useRef(onSelectGeofence);
  const onClickRef = useRef(onMapClick);
  useEffect(() => { onSelectEmpRef.current = onSelectEmployee; }, [onSelectEmployee]);
  useEffect(() => { onSelectGeoRef.current = onSelectGeofence; }, [onSelectGeofence]);
  useEffect(() => { onClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    let mounted = true;
    if (!containerRef.current || mapRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!mounted || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const initialCenter = center ?? [30.0444, 31.2357];
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        minZoom: 4,
        maxZoom: 18,
      }).setView(initialCenter, zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      layersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      map.on("click", (e: any) => {
        onClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layersRef.current;
    const L = leafletRef.current;
    if (!map || !group || !L) return;

    group.clearLayers();

    // 1. Orange dashed geofence circles with orange radius / count badge (matching mockups)
    geofences.forEach((g) => {
      const isSel = g.id === selectedId;
      const color = g.color ?? "#ea580c";
      const circle = L.circle([g.lat, g.lng], {
        radius: g.radius,
        color,
        weight: isSel ? 2.5 : 2,
        fillColor: color,
        fillOpacity: isSel ? 0.2 : 0.12,
        dashArray: "6 5",
      }).addTo(group);

      const labelText = g.count != null ? `${g.name} · ${g.count}` : `${g.name} (${g.radius} m)`;
      const pillIcon = L.divIcon({
        className: "",
        html: `<div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;background:#ea580c;color:#fff;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(234,88,12,0.35);border:1.5px solid #fff;">${g.count != null ? g.count : g.radius + " m"}</div>`,
        iconSize: [0, 0],
        iconAnchor: [16, -6],
      });

      const badge = L.marker([g.lat, g.lng], { icon: pillIcon })
        .bindTooltip(labelText, { direction: "top" })
        .addTo(group);

      if (onSelectGeoRef.current) {
        circle.on("click", () => onSelectGeoRef.current?.(g.id));
        badge.on("click", () => onSelectGeoRef.current?.(g.id));
      }
    });

    // 2. Route polyline & animated playback marker
    if (route && route.coords.length > 0) {
      L.polyline(route.coords, {
        color: route.color ?? "#2563eb",
        weight: 4,
        opacity: 0.9,
        dashArray: route.dashed ? "8 6" : undefined,
      }).addTo(group);

      const start = route.coords[0];
      const end = route.coords[route.coords.length - 1];

      const startIcon = L.divIcon({
        className: "",
        html: `<div style="width:24px;height:24px;border-radius:9999px;background:#16a34a;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);">S</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const endIcon = L.divIcon({
        className: "",
        html: `<div style="width:24px;height:24px;border-radius:9999px;background:#ea580c;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);">E</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker(start, { icon: startIcon }).bindTooltip(route.startLabel ?? "Start", { direction: "top" }).addTo(group);
      L.marker(end, { icon: endIcon }).bindTooltip(route.endLabel ?? "End", { direction: "top" }).addTo(group);

      if (route.animatedPosition) {
        const pulseIcon = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:#ea580c;border:3px solid #fff;box-shadow:0 0 0 5px rgba(234,88,12,0.3);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker(route.animatedPosition, { icon: pulseIcon }).addTo(group);
      }
    }

    // 3. Employees
    employees.forEach((e) => {
      const isSel = e.id === selectedId;
      const color = STATUS_COLORS[e.status] ?? "#16a34a";
      const initials = e.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:${isSel ? 34 : 24}px;height:${isSel ? 34 : 24}px;border-radius:9999px;background:${color};color:#fff;font-size:${isSel ? 11 : 9}px;font-weight:700;border:${isSel ? "3px solid #ffffff" : "2px solid #ffffff"};box-shadow:${isSel ? "0 0 0 4px rgba(234,88,12,0.35), 0 4px 10px rgba(0,0,0,0.25)" : "0 2px 5px rgba(0,0,0,0.22)"};cursor:pointer;">${initials}</div>`,
        iconSize: [isSel ? 34 : 24, isSel ? 34 : 24],
        iconAnchor: [isSel ? 17 : 12, isSel ? 17 : 12],
      });

      const marker = L.marker([e.lat, e.lng], { icon })
        .bindTooltip(`${e.name} (${e.code})${e.label ? " · " + e.label : ""}`, { direction: "top" })
        .addTo(group);

      marker.on("click", () => {
        onSelectEmpRef.current?.(e.id);
      });
    });

    // Smart camera framing
    if (selectedId) {
      const selEmp = employees.find((e) => e.id === selectedId);
      if (selEmp) {
        map.flyTo([selEmp.lat, selEmp.lng], Math.max(map.getZoom(), 13), { duration: 0.5 });
      } else {
        const selGeo = geofences.find((g) => g.id === selectedId);
        if (selGeo) {
          map.flyTo([selGeo.lat, selGeo.lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
        }
      }
    } else if (route && route.coords.length > 1) {
      map.fitBounds(L.latLngBounds(route.coords), { padding: [36, 36] });
    } else if (center) {
      map.setView(center, zoom);
    } else {
      const allPts: [number, number][] = [
        ...geofences.map((g) => [g.lat, g.lng] as [number, number]),
        ...employees.map((e) => [e.lat, e.lng] as [number, number]),
      ];
      if (allPts.length > 1) {
        map.fitBounds(L.latLngBounds(allPts), { padding: [40, 40], maxZoom: 14 });
      } else if (allPts.length === 1) {
        map.setView(allPts[0], 13);
      }
    }
  }, [geofences, employees, route, selectedId, center, zoom]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 z-0 relative"
    />
  );
}
