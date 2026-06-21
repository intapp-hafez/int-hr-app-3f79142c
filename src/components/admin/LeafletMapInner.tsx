import { MapContainer, TileLayer, CircleMarker, Circle, Popup, LayerGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { EGYPT_CENTER } from "@/lib/egypt-cities";

export type LeafletMapProps = {
  employees: Array<{ city: string; count: number; centroid: { lat: number; lng: number; en: string } }>;
  geofences: Array<{ id: string; name: string; lat: number; lng: number; radius_m: number }>;
  checkins: Array<{ id: string; employee_name: string; lat: number; lng: number; date: string; city: string | null }>;
};

export default function LeafletMapInner({ employees, geofences, checkins }: LeafletMapProps) {
  return (
    <MapContainer center={EGYPT_CENTER} zoom={6} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LayerGroup>
        {employees.map((e) => (
          <CircleMarker
            key={`emp-${e.centroid.en}`}
            center={[e.centroid.lat, e.centroid.lng]}
            radius={Math.min(22, 6 + Math.sqrt(e.count) * 3)}
            pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.45, weight: 1 }}
          >
            <Popup>
              <strong>{e.centroid.en}</strong>
              <br />
              {e.count} employee{e.count === 1 ? "" : "s"}
            </Popup>
          </CircleMarker>
        ))}
      </LayerGroup>
      <LayerGroup>
        {geofences.map((g) => (
          <Circle
            key={`gf-${g.id}`}
            center={[g.lat, g.lng]}
            radius={g.radius_m}
            pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.18, weight: 1 }}
          >
            <Popup>
              <strong>{g.name}</strong>
              <br />Geofence · {g.radius_m}m
            </Popup>
          </Circle>
        ))}
      </LayerGroup>
      <LayerGroup>
        {checkins.map((c) => (
          <CircleMarker
            key={`ci-${c.id}`}
            center={[c.lat, c.lng]}
            radius={4}
            pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.85, weight: 1 }}
          >
            <Popup>
              <strong>{c.employee_name}</strong>
              <br />
              {c.date}
              {c.city ? ` · ${c.city}` : ""}
            </Popup>
          </CircleMarker>
        ))}
      </LayerGroup>
    </MapContainer>
  );
}