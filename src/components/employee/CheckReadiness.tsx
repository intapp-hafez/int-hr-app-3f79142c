import { useEffect, useState } from "react";
import { MapPin, Wifi, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

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
  const { isAr } = useI18n();
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

  // GPS Readiness — privacy-hardened: never reveals geofence names or distance numbers
  let gps: { tone: Tone; title: string; detail: string; next?: string };
  if (gpsState === "unsupported") {
    gps = {
      tone: "fail",
      title: isAr ? "الموقع غير متاح" : "Location not available",
      detail: isAr ? "المتصفح لا يدعم تحديد الموقع الجغرافي." : "This browser can't share your location.",
    };
  } else if (gpsState === "denied") {
    gps = {
      tone: "fail",
      title: isAr ? "صلاحية الموقع محظورة" : "Location blocked",
      detail: isAr ? "يرجى تفعيل إذن الوصول للموقع من إعدادات المتصفح." : "Please enable location permission in browser settings.",
    };
  } else if (gpsState === "checking") {
    gps = {
      tone: "warn",
      title: isAr ? "جاري تحديد الموقع…" : "Finding your location…",
      detail: isAr ? "قد يستغرق ذلك بضع ثوانٍ." : "This can take a few seconds.",
    };
  } else if (!hasLocations) {
    gps = {
      tone: "ok",
      title: isAr ? "الموقع مسجل" : "Location recorded",
      detail: isAr ? "لا توجد منطقة عمل محددة لك، أي موقع مقبول." : "No work area is assigned to you, so any location is accepted.",
    };
  } else if (!nearest) {
    gps = {
      tone: "warn",
      title: isAr ? "جاري التحقق من النطاق…" : "Checking location…",
      detail: isAr ? "جاري فحص تواجدك في منطقة العمل." : "Verifying presence in your work area.",
    };
  } else if (nearest.inside) {
    gps = {
      tone: "ok",
      title: isAr ? "داخل النطاق المسموح" : "In Work Area",
      detail: isAr ? "تم التحقق من موقعك بنجاح." : "Your location is verified.",
    };
  } else {
    // Intentionally show ONLY "Out of Area" without leaking geofence names or distance numbers
    gps = {
      tone: "fail",
      title: isAr ? "خارج النطاق المسموح (Out of Area)" : "Out of Area",
      detail: isAr ? "أنت حالياً خارج منطقة العمل المحددة لك." : "You are currently outside your assigned work area.",
    };
  }

  // Network
  let net: { tone: Tone; title: string; detail: string; next?: string };
  if (!online) {
    net = {
      tone: "fail",
      title: isAr ? "غير متصل بالإنترنت" : "You are offline",
      detail: isAr ? "يتطلب تسجيل الحضور اتصالاً بالإنترنت." : "Check in needs an internet connection.",
    };
  } else if (networks.length === 0) {
    net = {
      tone: "ok",
      title: isAr ? "متصل بالإنترنت" : "Connected",
      detail: isAr ? "لا توجد شبكة محددة مطلوبة منك." : "No specific network is required for you.",
    };
  } else {
    net = {
      tone: "ok",
      title: isAr ? "الاتصال بالشبكة متاح" : "Connected",
      detail: isAr ? "اتصال البيانات أو الواي فاي نشط." : "Mobile data or Wi-Fi active.",
    };
  }

  // Work time
  let time: { tone: Tone; title: string; detail: string; next?: string };
  if (!shift) {
    time = {
      tone: "ok",
      title: isAr ? "بدون وردية محددة" : "No fixed shift",
      detail: isAr ? "يمكنك تسجيل الحضور في أي وقت." : "You can check in at any time.",
    };
  } else {
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = toMin(shift.start_time);
    let end = toMin(shift.end_time);
    if (shift.is_overnight && end <= start) end += 1440;
    const c = shift.is_overnight && cur < start && cur + 1440 <= end ? cur + 1440 : cur;
    const range = `${shift.name}: ${shift.start_time}–${shift.end_time}`;
    if (c < start - 120) {
      time = {
        tone: "warn",
        title: isAr ? "مبكر جداً" : "Too early",
        detail: range,
      };
    } else if (c <= start + shift.grace_minutes) {
      time = {
        tone: "ok",
        title: isAr ? "في الوقت المحدد" : "On time",
        detail: range,
      };
    } else if (c <= end) {
      time = {
        tone: "warn",
        title: isAr ? `متأخر بـ ${c - start} دقيقة` : `Late by ${c - start} min`,
        detail: range,
      };
    } else {
      time = {
        tone: "warn",
        title: isAr ? "انتهت الوردية" : "Shift has ended",
        detail: range,
      };
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {isAr ? "جاهزية التسجيل" : "Before you check in"}
      </p>
      <Row icon={<MapPin className="h-4 w-4" />} {...gps} />
      <Row icon={<Wifi className="h-4 w-4" />} {...net} />
      <Row icon={<Clock className="h-4 w-4" />} {...time} />
    </div>
  );
}

function Row({
  icon,
  tone,
  title,
  detail,
  next,
}: {
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  detail: string;
  next?: string;
}) {
  const cls =
    tone === "ok"
      ? "border-success/30 bg-success/10"
      : tone === "warn"
      ? "border-warning/40 bg-warning/10"
      : "border-destructive/30 bg-destructive/10";
  const Status = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : XCircle;
  const sc =
    tone === "ok"
      ? "text-success"
      : tone === "warn"
      ? "text-warning-foreground"
      : "text-destructive";

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${cls}`}>
      <div className="grid h-8 w-8 place-items-center rounded-full bg-background/80 shadow-xs shrink-0 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold leading-tight ${sc}`}>{title}</p>
        <p className="text-xs text-muted-foreground leading-normal mt-0.5">{detail}</p>
        {next && <p className="mt-1 text-xs font-medium text-foreground">→ {next}</p>}
      </div>
      <Status className={`h-5 w-5 shrink-0 ${sc}`} />
    </div>
  );
}
