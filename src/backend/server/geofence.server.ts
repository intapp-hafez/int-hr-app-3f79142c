// Shared geofence resolution for attendance gating and reporting.
//
// Each assignment may carry its own `radius_m` override (per-employee allowed
// distance). The column is optional — when the database has not been migrated
// yet we silently fall back to the location's own radius.

export type Fence = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
};

export type FenceCheck = {
  ok: boolean;
  name: string | null;
  distance_m: number | null;
  allowed_m: number | null;
};

export function distMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const LOCATION_SELECT = "profile_id, geofence_locations(id, name, lat, lng, radius_m, active)";

/**
 * Returns the active fences assigned to each of the given employees, with the
 * per-assignment radius override applied when present.
 */
export async function loadAssignedFences(
  supabase: any,
  profileIds: string[],
): Promise<Map<string, Fence[]>> {
  const map = new Map<string, Fence[]>();
  if (!profileIds.length) return map;

  let rows: any[] | null = null;
  const withOverride = await supabase
    .from("geofence_assignments")
    .select(`${LOCATION_SELECT}, radius_m`)
    .in("profile_id", profileIds);
  if (withOverride.error) {
    const fallback = await supabase
      .from("geofence_assignments")
      .select(LOCATION_SELECT)
      .in("profile_id", profileIds);
    if (fallback.error) return map;
    rows = fallback.data ?? [];
  } else {
    rows = withOverride.data ?? [];
  }

  for (const r of rows ?? []) {
    const l = r.geofence_locations;
    if (!l || !l.active) continue;
    const override = r.radius_m == null ? null : Number(r.radius_m);
    const fence: Fence = {
      id: l.id,
      name: l.name ?? "Work location",
      lat: Number(l.lat),
      lng: Number(l.lng),
      radius_m: override && override > 0 ? override : Number(l.radius_m ?? 100),
    };
    const list = map.get(r.profile_id) ?? [];
    list.push(fence);
    map.set(r.profile_id, list);
  }
  return map;
}

/** Nearest fence evaluation; `null` when there is nothing to evaluate. */
export function evaluateFence(
  fences: Fence[],
  lat: number | null | undefined,
  lng: number | null | undefined,
): FenceCheck | null {
  if (!fences.length) return null;
  if (lat == null || lng == null) {
    return { ok: false, name: null, distance_m: null, allowed_m: fences[0]!.radius_m };
  }
  let best: FenceCheck | null = null;
  for (const f of fences) {
    const d = distMeters(Number(lat), Number(lng), f.lat, f.lng);
    if (!best || best.distance_m == null || d < best.distance_m) {
      best = { ok: d <= f.radius_m, name: f.name, distance_m: Math.round(d), allowed_m: f.radius_m };
    }
    if (d <= f.radius_m) break;
  }
  return best;
}
