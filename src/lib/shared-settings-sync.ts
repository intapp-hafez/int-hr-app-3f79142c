import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SHARED_SETTINGS_TABLES = [
  "geofence_locations", "employee_geofences", "positions", "trip_allowance_policies",
] as const;

// These caches include combined directory/access reads as well as the matrix.
export function isSharedSettingsQuery(key: QueryKey): boolean {
  return key.some((part) => typeof part === "string" && (
    /geofence|work-location|position|trip-allowance/.test(part) ||
    ["my-access", "access", "org-chart", "directory", "employee-form-options", "employee-options"].includes(part)
  ));
}

/** One RLS-scoped feed per signed-in app, with recovery for missed events. */
export function startSharedSettingsSync(client: SupabaseClient, queryClient: QueryClient) {
  let disposed = false;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (disposed || document.visibilityState === "hidden" || !navigator.onLine) return;
    void queryClient.invalidateQueries({
      predicate: (query) => isSharedSettingsQuery(query.queryKey),
      refetchType: "active",
    }, { cancelRefetch: false });
  };
  const scheduleRefresh = () => {
    if (disposed || pending !== undefined) return;
    pending = setTimeout(() => { pending = undefined; refresh(); }, 100);
  };
  let channel = client.channel(`shared-settings-${crypto.randomUUID()}`);
  for (const table of SHARED_SETTINGS_TABLES) {
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
  }
  channel.subscribe((status) => {
    // Includes reconnections: refresh anything changed while disconnected.
    if (status === "SUBSCRIBED") scheduleRefresh();
  });
  // Publication may not yet be enabled, or a change may be missed during sleep.
  // Only mounted settings-related queries refetch; hidden/offline apps do no work.
  const recovery = setInterval(refresh, 5000);
  window.addEventListener("online", scheduleRefresh);
  window.addEventListener("focus", scheduleRefresh);
  document.addEventListener("visibilitychange", scheduleRefresh);
  return () => {
    disposed = true;
    if (pending !== undefined) clearTimeout(pending);
    clearInterval(recovery);
    window.removeEventListener("online", scheduleRefresh);
    window.removeEventListener("focus", scheduleRefresh);
    document.removeEventListener("visibilitychange", scheduleRefresh);
    void client.removeChannel(channel);
  };
}

export function rateCells(
  policies: Array<{ geofence_location_id: string; position_id: string; nightly_rate: number }>,
  drafts: Record<string, string>,
) {
  const saved: Record<string, string> = {};
  for (const policy of policies) {
    saved[`${policy.geofence_location_id}:${policy.position_id}`] = String(policy.nightly_rate ?? "");
  }
  return { ...saved, ...drafts };
}