import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: number | string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  active?: boolean;
};

export type MapPoint = {
  id: number | string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
};

type Props = {
  markers: MapMarker[];
  points?: MapPoint[];
  selectedId?: number | string;
  onSelect?: (id: number | string) => void;
  height?: number | string;
  onMapClick?: (lat: number, lng: number) => void;
  onRadiusChange?: (id: number | string, radius: number) => void;
  editableId?: number | string;
  zoom?: number;
};

export function LeafletMap({ markers, points = [], selectedId, onSelect, height = 420, onMapClick, onRadiusChange, editableId, zoom }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef<typeof onMapClick>(onMapClick);
  const radiusRef = useRef<typeof onRadiusChange>(onRadiusChange);
  useEffect(() => { clickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { radiusRef.current = onRadiusChange; }, [onRadiusChange]);

  // Init map once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    // Default view: Egypt (Cairo) when no markers are supplied.
    const initLat = markers[0]?.lat ?? 26.8206;
    const initLng = markers[0]?.lng ?? 30.8025;
    const initZoom = markers.length ? 6 : 6;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true })
      .setView([initLat, initLng], initZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on("click", (e: L.LeafletMouseEvent) => {
      clickRef.current?.(e.latlng.lat, e.latlng.lng);
    });
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External zoom control
  useEffect(() => {
    if (!mapRef.current || zoom == null) return;
    if (mapRef.current.getZoom() !== zoom) mapRef.current.setZoom(zoom);
  }, [zoom]);

  // Re-render markers when data changes
  useEffect(() => {
    const map = mapRef.current;
    const group = layersRef.current;
    if (!map || !group) return;
    group.clearLayers();

    const brand = "#ea580c";
    const dim = "#94a3b8";

    markers.forEach((m) => {
      const isActive = m.id === selectedId;
      const color = m.active === false ? dim : brand;
      const circle = L.circle([m.lat, m.lng], {
        radius: m.radius,
        color,
        weight: isActive ? 3 : 1.5,
        fillColor: color,
        fillOpacity: isActive ? 0.25 : 0.12,
      }).addTo(group);
      const pin = L.circleMarker([m.lat, m.lng], {
        radius: isActive ? 7 : 5,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(`${m.name} · ${m.radius}m`, { permanent: false, direction: "top" })
        .addTo(group);
      const handler = () => onSelect?.(m.id);
      circle.on("click", handler);
      pin.on("click", handler);

      // Drag-to-resize handle for the editable marker
      if (editableId != null && m.id === editableId && radiusRef.current) {
        const center = L.latLng(m.lat, m.lng);
        const earth = 6378137;
        const dLng = (m.radius / (earth * Math.cos((m.lat * Math.PI) / 180))) * (180 / Math.PI);
        const handlePos = L.latLng(m.lat, m.lng + dLng);
        const handleIcon = L.divIcon({
          className: "",
          html: '<div style="width:14px;height:14px;border-radius:9999px;background:#ea580c;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:ew-resize"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const handle = L.marker(handlePos, { icon: handleIcon, draggable: true, autoPan: true })
          .bindTooltip("Drag to resize", { direction: "top" })
          .addTo(group);
        const onDrag = () => {
          const pos = handle.getLatLng();
          const r = Math.round(center.distanceTo(pos));
          circle.setRadius(r);
          handle.setTooltipContent(`${r} m`);
        };
        handle.on("drag", onDrag);
        handle.on("dragend", () => {
          const pos = handle.getLatLng();
          const r = Math.max(10, Math.min(5000, Math.round(center.distanceTo(pos))));
          radiusRef.current?.(m.id, r);
        });
      }
    });

    points.forEach((p) => {
      const dot = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        color: "#fff",
        weight: 2,
        fillColor: p.color ?? "#2563eb",
        fillOpacity: 1,
      }).addTo(group);
      if (p.label) dot.bindTooltip(p.label, { direction: "top" });
    });

    if (selectedId != null) {
      const sel = markers.find((m) => m.id === selectedId);
      if (sel) map.flyTo([sel.lat, sel.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
    }
  }, [markers, points, selectedId, onSelect, editableId]);

  return <div ref={ref} style={{ height, width: "100%" }} className="rounded-3xl overflow-hidden" />;
}
