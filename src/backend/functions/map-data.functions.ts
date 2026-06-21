import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MapGeofence = { id: string; name: string; lat: number; lng: number; radius_m: number };
export type MapCheckin = { id: string; employee_name: string; lat: number; lng: number; date: string; city: string | null };
export type MapEmployeeCity = { city: string; count: number };

export type AdminMapData = {
  geofences: MapGeofence[];
  checkins: MapCheckin[];
  employeeCities: MapEmployeeCity[];
};

export const getAdminMapData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMapData> => {
    const { supabase } = context;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [gfRes, attRes, profRes] = await Promise.all([
      supabase.from("geofence_locations").select("id, name, lat, lng, radius_m, active").eq("active", true).limit(500),
      supabase
        .from("attendance")
        .select("id, date, city, lat, lng, employee_id, profiles:employee_id(full_name)")
        .gte("date", sevenDaysAgo)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .order("date", { ascending: false })
        .limit(500),
      supabase.from("profiles").select("city").not("city", "is", null).limit(5000),
    ]);

    if (gfRes.error) throw new Error(gfRes.error.message);
    if (attRes.error) throw new Error(attRes.error.message);
    if (profRes.error) throw new Error(profRes.error.message);

    const geofences: MapGeofence[] = (gfRes.data ?? [])
      .filter((g: any) => g.lat != null && g.lng != null)
      .map((g: any) => ({ id: g.id, name: g.name, lat: Number(g.lat), lng: Number(g.lng), radius_m: Number(g.radius_m ?? 100) }));

    const checkins: MapCheckin[] = (attRes.data ?? []).map((a: any) => ({
      id: a.id,
      employee_name: a.profiles?.full_name ?? "—",
      lat: Number(a.lat),
      lng: Number(a.lng),
      date: a.date,
      city: a.city ?? null,
    }));

    const cityMap = new Map<string, number>();
    (profRes.data ?? []).forEach((p: any) => {
      const c = (p.city ?? "").trim();
      if (!c) return;
      cityMap.set(c, (cityMap.get(c) ?? 0) + 1);
    });
    const employeeCities: MapEmployeeCity[] = Array.from(cityMap.entries()).map(([city, count]) => ({ city, count }));

    return { geofences, checkins, employeeCities };
  });