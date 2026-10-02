import { useEffect, useState } from "react";
import { MapPin, Wifi, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Tone = "ok" | "warn" | "fail";
type Shift = { name: string; start_time: string; end_time: string; grace_minutes: number; is_overnight: boolean } | null;

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function CheckReadiness({
  nearest,
  hasLocations,
  networks,
  shift,
}: {
  nearest: { name: string; distance: number; radius: number; inside: boolean } | null;
  hasLocations: boolean;
  networks: { name: string; ssid: string | null }[];
  shift: Shift;
}) {
  const [gpsState, setGpsState] = useState<"checking" | "ok" | "denied" | "unsupported">("checking");
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const id = setInterval(() => setNow(new Date()), 30_000);
    if (!navigator.geolocation) setGpsState("unsupported");
    else
      navigator.geolocation.getCurrentPosition(
        () => setGpsState("ok"),
        () => setGpsState("denied"),
        { timeout: 10000 },
      );
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(id);
    };
  }, []);

  // GPS
  let gps: { tone: Tone; title: string; detail: string; next?: string };
  if (gpsState === "unsupported") gps = { tone: "fail", title: "Location not available", detail: "This browser can't share your location.", next: "Open the app in Chrome or Safari on your phone." };
  else if (gpsState === "denied") gps = { tone: "fail", title: "Location blocked", detail: "We couldn't read your location.", next: "Allow location for this site in your browser settings, turn on GPS, then reload." };
  else if (gpsState === "checking") gps = { tone: "warn", title: "Finding your location…", detail: "This can take a few seconds outdoors or near a window." };
  else if (!hasLocations) gps = { tone: "ok", title: "Location recorded", detail: "No work area is assigned to you, so any location is accepted." };
  else if (!nearest) gps = { tone: "warn", title: "Measuring distance…", detail: "Comparing your position with your work area." };
  else if (nearest.inside) gps = { tone: "ok", title: `Inside ${nearest.name}`, detail: `${Math.round(nearest.distance)} m from center (allowed ${nearest.radius} m).` };
  else gps = { tone: "fail", title: `Outside ${nearest.name}`, detail: `You are ${Math.round(nearest.distance - nearest.radius)} m outside the allowed area.`, next: "Move closer to your workplace, wait for a stronger GPS signal, then try again." };

  // Network
  let net: { tone: Tone; title: string; detail: string; next?: string };
  if (!online) net = { tone: "fail", title: "You are offline", detail: "Check in needs an internet connection.", next: "Turn on Wi-Fi or mobile data and try again." };
  else if (networks.length === 0) net = { tone: "ok", title: "Connected", detail: "No specific network is required for you." };
  else net = { tone: "warn", title: "Use the office network", detail: `Authorized: ${networks.map((n) => n.ssid || n.name).join(", ")}.`, next: "Connect to one of these Wi-Fi networks before checking in." };

  // Work time
  let time: { tone: Tone; title: string; detail: string; next?: string };
  if (!shift) time = { tone: "ok", title: "No fixed shift", detail: "You can check in at any time." };
  else {
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = toMin(shift.start_time);
    let end = toMin(shift.end_time);
    if (shift.is_overnight && end <= start) end += 1440;
    const c = shift.is_overnight && cur < start && cur + 1440 <= end ? cur + 1440 : cur;
    const range = `${shift.name}: ${shift.start_time}–${shift.end_time}`;
    if (c < start - 120) time = { tone: "warn", title: "Too early", detail: `${range}.`, next: `Check in closer to ${shift.start_time}.` };
    else if (c <= start + shift.grace_minutes) time = { tone: "ok", title: "On time", detail: `${range} (grace ${shift.grace_minutes} min).` };
    else if (c <= end) time = { tone: "warn", title: `Late by ${c - start} min`, detail: `${range}.`, next: "You can still check in; it will be recorded as late." };
    else time = { tone: "warn", title: "Shift has ended", detail: `${range}.`, next: "Contact your manager if you need to record attendance." };
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before you check in</p>
      <Row icon={<MapPin className="h-4 w-4" />} {...gps} />
      <Row icon={<Wifi className="h-4 w-4" />} {...net} />
      <Row icon={<Clock className="h-4 w-4" />} {...time} />
    </div>
  );
}

function Row({ icon, tone, title, detail, next }: { icon: React.ReactNode; tone: Tone; title: string; detail: string; next?: string }) {
  const cls = tone === "ok" ? "border-success/30 bg-success/10" : tone === "warn" ? "border-warning/40 bg-warning/10" : "border-destructive/30 bg-destructive/10";
  const Status = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : XCircle;
  const sc = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning-foreground" : "text-destructive";
  return (
    <div className={`flex gap-3 rounded-xl border px-3 py-2.5 ${cls}`}>
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${sc}`}>{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
        {next && <p className="mt-1 text-xs font-medium text-foreground">→ {next}</p>}
      </div>
      <Status className={`h-5 w-5 shrink-0 ${sc}`} />
    </div>
  );
}
