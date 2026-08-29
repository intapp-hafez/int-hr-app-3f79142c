import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, MapPinOff, Wifi, WifiOff, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/date-format";
import { listMyCheckValidations } from "@/backend/functions/attendance.functions";

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

type Fence = { ok: boolean; name: string | null; distance_m: number | null; allowed_m: number | null } | null;

function FenceBadge({ fence, freeCheck }: { fence: Fence; freeCheck: boolean }) {
  if (freeCheck)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        <ShieldCheck className="h-3 w-3" /> No restriction
      </span>
    );
  if (!fence)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
        <MapPinOff className="h-3 w-3" /> No GPS
      </span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        fence.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      }`}
    >
      <MapPin className="h-3 w-3" />
      {fence.ok ? "Inside" : "Outside"} {fence.name ?? "fence"}
      {fence.distance_m != null ? ` · ${fence.distance_m}m / ${fence.allowed_m}m` : ""}
    </span>
  );
}

export function ValidationHistoryPanel() {
  const fn = useServerFn(listMyCheckValidations);
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-check-validations"],
    queryFn: () => fn({ data: { limit: 30 } }),
  });

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">Geofence &amp; network validation</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 30 days</span>
      </header>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Loading…
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No check-in history yet
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold tabular-nums">{formatDate(r.date)}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.network_ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.network_ok ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {r.network_ok ? "Authorized network" : "Network not matched"}
                </span>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Check-in · {fmtTime(r.in_time)}
                  </p>
                  <FenceBadge fence={r.in_geofence} freeCheck={r.free_check} />
                  {r.in_place && <p className="text-[11px] text-muted-foreground">{r.in_place}</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Check-out · {fmtTime(r.out_time)}
                  </p>
                  {r.out_time ? (
                    <FenceBadge fence={r.out_geofence} freeCheck={r.free_check} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Not checked out</span>
                  )}
                  {r.out_place && <p className="text-[11px] text-muted-foreground">{r.out_place}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
