import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  LogIn,
  LogOut,
  MapPin,
  Plus,
  X,
  Wifi,
  WifiOff,
  Paperclip,
  FileText,
  ShieldCheck,
  Clock,
  Calendar,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Timer,
  Sparkles,
  ArrowRight,
  Laptop,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { checkIn, checkOut, listMyAttendance } from "@/backend/functions/attendance.functions";
import { listMyDevices, registerMyDevice } from "@/backend/functions/devices.functions";
import { getMe } from "@/backend/functions/auth.functions";
import { submitLeave, listMyLeaves, cancelLeave, listActiveLeaveTypes } from "@/backend/functions/leaves.functions";
import { useSession, useAuthReady } from "@/lib/auth";
import { getCurrentDeviceId } from "@/lib/store";
import { DateRangeField } from "@/components/ui/date-input";
import { formatDate, validateDateRange } from "@/lib/date-format";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/manager/check")({ component: CheckPage });

function CheckPage() {
  const ready = useAuthReady();
  const session = useSession();
  const { t, isAr } = useI18n();

  // Digital live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!ready) return null;
  if (!session) return <Navigate to="/auth" replace />;
  if (session.role !== "manager") {
    if (session.role === "admin") return <Navigate to="/admin" replace />;
    if (session.role === "staff") return <Navigate to="/staff" replace />;
    return <Navigate to="/employee" replace />;
  }

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* ── Top Header Banner ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <ShieldCheck className="h-4 w-4" />
            <span>{isAr ? "سجل الحضور الذاتي" : "Manager Attendance Hub"}</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {isAr ? "تسجيل الحضور والانصراف" : "Check In / Out"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {isAr
              ? "سجّل مواعيد عملك اليومية وتابع سجل الحضور وطلبات الإجازة الخاصة بك."
              : "Record your daily attendance, monitor shift duration, and review time off."}
          </p>
        </div>

        {/* Live Digital Clock Widget */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-2.5 shadow-xs self-start sm:self-auto">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base sm:text-lg font-bold tracking-tight text-foreground">
                {timeStr}
              </span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground truncate">{dateStr}</p>
          </div>
        </div>
      </div>

      {/* ── Check In / Out Core & Side Content ── */}
      <CheckInOutSection now={now} />
    </div>
  );
}

function CheckInOutSection({ now }: { now: Date }) {
  const qc = useQueryClient();
  const { t, isAr } = useI18n();
  const inFn = useServerFn(checkIn);
  const outFn = useServerFn(checkOut);
  const devicesFn = useServerFn(listMyDevices);
  const registerFn = useServerFn(registerMyDevice);
  const meFn = useServerFn(getMe);
  const attFn = useServerFn(listMyAttendance);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const devQ = useQuery({ queryKey: ["my-devices"], queryFn: () => devicesFn() });
  const attQ = useQuery({ queryKey: ["my-attendance"], queryFn: () => attFn() });

  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const isoToday = now.toISOString().slice(0, 10);
  const localToday = now.toLocaleDateString("en-CA");
  const attendance = (attQ.data as any[]) ?? [];
  const todayRow = attendance.find((a) => a.date === isoToday || a.date === localToday);
  const latestRecord = attendance[0];
  const activeRow =
    todayRow ||
    (latestRecord &&
    !latestRecord.out_time &&
    Date.now() - new Date(latestRecord.in_time).getTime() < 18 * 3600 * 1000
      ? latestRecord
      : null);

  const hasCheckedIn = !!activeRow?.in_time;
  const hasCheckedOut = !!activeRow?.out_time;

  // Active work duration
  const activeDuration = useMemo(() => {
    if (!activeRow?.in_time) return null;
    const start = new Date(activeRow.in_time).getTime();
    const end = activeRow.out_time ? new Date(activeRow.out_time).getTime() : now.getTime();
    const diff = Math.max(0, end - start);
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return {
      hrs,
      mins,
      secs,
      formatted: `${hrs.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`,
    };
  }, [activeRow?.in_time, activeRow?.out_time, now]);

  const deviceCheckRequired = !!(meQ.data as any)?.profile?.device_check_required;
  const currentDevice = devQ.data?.find((d: any) => d.id === getCurrentDeviceId());
  const deviceApproved = !deviceCheckRequired || currentDevice?.status === "approved";

  async function handleRegisterDevice() {
    try {
      await registerFn({
        data: {
          device_id: getCurrentDeviceId(),
          label:
            typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
              ? "Windows PC"
              : "Web Browser",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        },
      });
      toast.success(isAr ? "تم تسجيل الجهاز. في انتظار موافقة المسؤول." : "Device registered. Awaiting administrator approval.");
      qc.invalidateQueries({ queryKey: ["my-devices"] });
    } catch (e: any) {
      toast.error(e?.message ?? (isAr ? "فشل تسجيل الجهاز" : "Failed to register device"));
    }
  }

  async function getCoords() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return { err: "Geolocation not supported" };
    return new Promise<{ lat?: number; lng?: number; accuracy_m?: number; err?: string }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy ?? undefined }),
        (e) => resolve({ err: e.message }),
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  }

  async function go(kind: "in" | "out") {
    setBusy(kind);
    const toastId = toast.loading(isAr ? "جاري تسجيل الحضور، برجاء الانتظار..." : "Recording attendance, please wait...");
    try {
      const coords = await getCoords();
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      const geo = coords.lat != null && coords.lng != null ? await reverseGeocodeCoords(coords.lat, coords.lng) : {};
      const resolvedBranch =
        (geo.district && geo.city ? `${geo.district}, ${geo.city}` : geo.city || geo.district) ||
        (meQ.data as any)?.profile?.branch ||
        "HQ";

      const payload = {
        branch: resolvedBranch,
        lat: coords.lat,
        lng: coords.lng,
        accuracy_m: coords.accuracy_m ?? null,
        network_ok: online,
        note: note.trim() || undefined,
        device_id: getCurrentDeviceId(),
        city: geo.city,
        district: geo.district,
        street: geo.street,
      };

      if (kind === "in") {
        const res: any = await inFn({ data: payload });
        if (res?.blocked) {
          toast.error(isAr ? "تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة." : "Check-in blocked. Please contact admin.", { id: toastId });
          return;
        }
        toast.success(isAr ? "تم تسجيل الحضور بنجاح" : "Checked in successfully!", { id: toastId });
      } else {
        const res: any = await outFn({ data: payload });
        if (res?.blocked) {
          toast.error(isAr ? "تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة." : "Check-out blocked. Please contact admin.", { id: toastId });
          return;
        }
        toast.success(isAr ? "تم تسجيل الانصراف بنجاح" : "Checked out successfully!", { id: toastId });
      }
      setNote("");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      qc.invalidateQueries({ queryKey: ["manager-dashboard-data"] });
    } catch (e: any) {
      toast.error(e?.message ?? (isAr ? "تعذر إتمام العملية حاليًا." : "Failed to record attendance."), { id: toastId });
    } finally {
      setBusy(null);
    }
  }

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  return (
    <div className="space-y-6">
      {/* ── KPI Metrics Row ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* Status */}
        <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{isAr ? "حالة اليوم" : "Today's Status"}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                hasCheckedOut
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : hasCheckedIn
                  ? "bg-brand/15 text-brand"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {hasCheckedOut
                ? isAr ? "مكتمل" : "Completed"
                : hasCheckedIn
                ? isAr ? "على رأس العمل" : "Active"
                : isAr ? "لم يبدأ بعد" : "Not Started"}
            </span>
          </div>
          <p className="mt-2 font-display text-xl font-bold text-foreground">
            {hasCheckedOut
              ? isAr ? "تم الانصراف" : "Finished Shift"
              : hasCheckedIn
              ? isAr ? "حاضر الآن" : "Working Now"
              : isAr ? "غير مسجل" : "Pending In"}
          </p>
        </div>

        {/* In Time */}
        <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{isAr ? "وقت الحضور" : "Check-in Time"}</span>
            <LogIn className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-display text-xl font-bold text-foreground">
            {activeRow?.in_time
              ? new Date(activeRow.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "—"}
          </p>
        </div>

        {/* Out Time */}
        <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{isAr ? "وقت الانصراف" : "Check-out Time"}</span>
            <LogOut className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 font-display text-xl font-bold text-foreground">
            {activeRow?.out_time
              ? new Date(activeRow.out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : hasCheckedIn
              ? isAr ? "قيد العمل..." : "In progress..."
              : "—"}
          </p>
        </div>

        {/* Hours / Timer */}
        <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{isAr ? "ساعات اليوم" : "Today's Hours"}</span>
            <Timer className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-foreground">
            {activeDuration ? `${activeDuration.hrs}h ${activeDuration.mins}m` : "0h 00m"}
          </p>
        </div>
      </div>

      {/* ── Main Interactive 2-Column Grid ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Col: Hero Punch Card & Recent Log (7 Cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Hero Punch Card */}
          <div className="relative overflow-hidden rounded-3xl border border-border/90 bg-gradient-to-b from-card via-card to-muted/20 p-6 shadow-sm">
            {/* Top Sub-bar */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4 text-xs">
              <div className="flex items-center gap-2">
                {online ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <Wifi className="h-3 w-3" />
                    <span>{isAr ? "متصل بالإنترنت" : "Online"}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                    <WifiOff className="h-3 w-3" />
                    <span>{isAr ? "غير متصل" : "Offline"}</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-brand" />
                  <span>{(meQ.data as any)?.profile?.branch || "HQ Main Office"}</span>
                </span>
              </div>

              <button
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["my-attendance"] });
                  qc.invalidateQueries({ queryKey: ["me"] });
                }}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
                title={isAr ? "تحديث" : "Refresh"}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Central State Graphic & Callout */}
            <div className="py-6 text-center">
              {hasCheckedOut ? (
                <div className="mx-auto flex flex-col items-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 shadow-inner">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-foreground">
                    {isAr ? "اكتمل دوام اليوم بنجاح" : "Workday Complete!"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                    {isAr
                      ? `تم تسجيل الحضور والانصراف. إجمالي ساعات اليوم: ${activeDuration?.hrs ?? 0} ساعة و ${activeDuration?.mins ?? 0} دقيقة.`
                      : `You have successfully checked out. Total recorded time today: ${activeDuration?.hrs ?? 0}h ${activeDuration?.mins ?? 0}m.`}
                  </p>
                </div>
              ) : hasCheckedIn ? (
                <div className="mx-auto flex flex-col items-center">
                  <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-brand/15 text-brand shadow-inner">
                    <Timer className="h-8 w-8" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-brand"></span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="font-mono text-2xl font-bold tracking-tight text-brand">
                      {activeDuration?.formatted ?? "00h 00m 00s"}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isAr
                        ? `بدأ الدوام في ${new Date(activeRow!.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : `Shift started at ${new Date(activeRow!.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex flex-col items-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
                    <Clock className="h-8 w-8" />
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-foreground">
                    {isAr ? "جاهز لبدء يوم العمل؟" : "Ready to begin your workday?"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                    {isAr
                      ? "اضغط على تسجيل الحضور بالأسفل لبدء احتساب ساعات العمل."
                      : "Click Check In below to record your start time and location."}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {deviceCheckRequired && !deviceApproved ? (
              <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{isAr ? "هذا الجهاز غير معتمد بعد" : "Device Awaiting Approval"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {!currentDevice
                    ? isAr
                      ? "هذا الجهاز غير مسجل في حسابك. يرجى تسجيله أولاً."
                      : "This browser/device is not registered. Please register it for review."
                    : isAr
                      ? "تم تسجيل الجهاز وهو قيد مراجعة واعتماد المسؤول."
                      : "Device is registered and pending administrator approval."}
                </p>
                {!currentDevice && (
                  <button
                    onClick={handleRegisterDevice}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-xs hover:bg-brand/90 transition"
                  >
                    <Laptop className="h-3.5 w-3.5" />
                    <span>{isAr ? "تسجيل هذا الجهاز الآن" : "Register This Device"}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Check In Button */}
                  <button
                    disabled={busy !== null || hasCheckedIn}
                    onClick={() => go("in")}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all shadow-sm ${
                      hasCheckedIn
                        ? "border border-border/60 bg-muted/50 text-muted-foreground opacity-60 cursor-not-allowed"
                        : "bg-gradient-brand text-brand-foreground shadow-brand hover:opacity-95 active:scale-[0.98]"
                    }`}
                  >
                    {busy === "in" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="h-4 w-4" />
                    )}
                    <span>
                      {busy === "in"
                        ? isAr ? "جاري التسجيل..." : "Checking in…"
                        : hasCheckedIn
                        ? isAr ? "تم تسجيل الحضور ✓" : "Checked in ✓"
                        : isAr ? "تسجيل الحضور" : "Check in"}
                    </span>
                  </button>

                  {/* Check Out Button */}
                  <button
                    disabled={busy !== null || !hasCheckedIn || hasCheckedOut}
                    onClick={() => go("out")}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all shadow-sm ${
                      hasCheckedOut
                        ? "border border-border/60 bg-muted/50 text-muted-foreground opacity-60 cursor-not-allowed"
                        : hasCheckedIn
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20 active:scale-[0.98]"
                        : "border border-border/60 bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed"
                    }`}
                  >
                    {busy === "out" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    <span>
                      {busy === "out"
                        ? isAr ? "جاري الانصراف..." : "Checking out…"
                        : hasCheckedOut
                        ? isAr ? "تم تسجيل الانصراف ✓" : "Checked out ✓"
                        : isAr ? "تسجيل الانصراف" : "Check out"}
                    </span>
                  </button>
                </div>

                {/* Optional Note Accordion */}
                <div className="pt-1">
                  {!showNote ? (
                    <button
                      type="button"
                      onClick={() => setShowNote(true)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground transition underline underline-offset-4"
                    >
                      {isAr ? "+ إضافة ملاحظة حضور (اختياري)" : "+ Add check-in note (optional)"}
                    </button>
                  ) : (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{isAr ? "ملاحظة الحضور والانصراف" : "Attendance Note"}</span>
                        <button
                          onClick={() => {
                            setShowNote(false);
                            setNote("");
                          }}
                          className="hover:text-foreground"
                        >
                          {isAr ? "إلغاء" : "Cancel"}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={isAr ? "مثال: اجتماع عميل، عمل عن بُعد..." : "e.g. Client visit, remote site..."}
                        className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Recent Attendance History ── */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-brand" />
                <span>{isAr ? "سجل الحضور الأخير" : "Recent Attendance Records"}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {attendance.length} {isAr ? "سجل مسجل" : "records"}
              </span>
            </div>

            {attQ.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : attendance.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center">
                <Clock className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  {isAr ? "لا توجد سجلات حضور سابقة" : "No attendance records yet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAr
                    ? "سجل حضورك اليوم وسيظهر في هذا الجدول تلقائيًا."
                    : "Check in today and your records will appear here automatically."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {attendance.slice(0, 7).map((a: any) => {
                  const duration =
                    a.in_time && a.out_time
                      ? Math.round(
                          ((new Date(a.out_time).getTime() - new Date(a.in_time).getTime()) /
                            (1000 * 60 * 60)) *
                            10
                        ) / 10
                      : null;

                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted/60 text-foreground font-semibold text-xs">
                          {new Date(a.date).toLocaleDateString("en-US", { day: "2-digit" })}
                          <span className="text-[9px] uppercase text-muted-foreground">
                            {new Date(a.date).toLocaleDateString("en-US", { month: "short" })}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {formatDate(a.date)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {a.in_time
                                ? new Date(a.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : "—"}
                            </span>
                            <span>→</span>
                            <span>
                              {a.out_time
                                ? new Date(a.out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : isAr ? "مستمر..." : "Active"}
                            </span>
                            {duration != null && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-foreground">{duration} hrs</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-end">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            a.status === "present"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : a.status === "late"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {a.status ?? "Present"}
                        </span>
                        {a.branch && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[100px]">
                            {a.branch}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Leaves Quick Card & Security Card (5 Cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Leaves & Requests Card */}
          <LeavesSummaryCard />

          {/* Device & Security Card */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
              <Laptop className="h-4 w-4 text-brand" />
              <span>{isAr ? "معلومات الجهاز والمطابقة" : "Device & Policy Status"}</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5">
                <span className="text-muted-foreground">{isAr ? "معرف الجهاز الحالي" : "Device ID"}</span>
                <span className="font-mono text-[11px] font-medium text-foreground truncate max-w-[150px]">
                  {getCurrentDeviceId()}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5">
                <span className="text-muted-foreground">{isAr ? "حالة التحقق من الجهاز" : "Device Approval"}</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    deviceApproved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"
                  }`}
                >
                  {deviceApproved ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>{isAr ? "معتمد" : "Approved"}</span>
                    </>
                  ) : (
                    <span>{isAr ? "قيد المراجعة" : "Pending"}</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5">
                <span className="text-muted-foreground">{isAr ? "النطاق الجغرافي" : "Geofencing"}</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Check className="h-3.5 w-3.5" />
                  <span>{isAr ? "مفعّل" : "Active & Verified"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeavesSummaryCard() {
  const { t, isAr } = useI18n();
  const qc = useQueryClient();
  const list = useServerFn(listMyLeaves);
  const submit = useServerFn(submitLeave);
  const cancel = useServerFn(cancelLeave);
  const q = useQuery({ queryKey: ["my-leaves"], queryFn: () => list() });

  const [open, setOpen] = useState(false);

  const leaves = (q.data as any[]) ?? [];
  const pendingLeaves = leaves.filter((l) => l.status === "pending");

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
      toast.success(isAr ? "تم إلغاء الطلب" : "Request cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <CalendarCheck className="h-4 w-4 text-brand" />
          <span>{isAr ? "إجازاتي الخاصة" : "My Leaves & Time Off"}</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isAr ? "طلب إجازة" : "Request"}</span>
        </button>
      </div>

      {q.isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : leaves.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center">
          <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-xs font-medium text-foreground">
            {isAr ? "لا توجد طلبات إجازة سابقة" : "No leave requests yet"}
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-2 text-xs font-semibold text-brand hover:underline"
          >
            {isAr ? "تقديم طلب إجازة جديد ←" : "Submit a new request →"}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {leaves.slice(0, 3).map((l: any) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {l.leave_type_name ?? "Leave"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(l.start_date)} → {formatDate(l.end_date)} • {l.days}d
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    l.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : l.status === "rejected"
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {l.status}
                </span>

                {l.status === "pending" && (
                  <button
                    disabled={cancelMutation.isPending}
                    onClick={() => {
                      if (confirm(isAr ? "هل أنت متأكد من إلغاء هذا الطلب؟" : "Cancel this leave request?")) {
                        cancelMutation.mutate(l.id);
                      }
                    }}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition"
                    title={isAr ? "إلغاء الطلب" : "Cancel request"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Link to manager full leaves portal */}
          <Link
            to="/manager/leaves"
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-medium text-brand hover:bg-brand/5 transition"
          >
            <span>{isAr ? "إدارة الإجازات والأذونات بالكامل" : "Open Full Leaves & Permissions Portal"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Leave Modal */}
      {open && (
        <LeaveModal
          onClose={() => setOpen(false)}
          onSubmit={async (d) => {
            try {
              await submit({ data: d });
              toast.success(isAr ? "تم إرسال طلب الإجازة بنجاح" : "Leave request submitted successfully");
              qc.invalidateQueries({ queryKey: ["my-leaves"] });
              setOpen(false);
            } catch (e: any) {
              toast.error(e?.message ?? "Failed to submit leave");
            }
          }}
        />
      )}
    </div>
  );
}

function LeaveModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (d: {
    leave_type_id?: string | null;
    leave_type_name: string;
    start_date: string;
    end_date: string;
    days: number;
    paid: boolean;
    reason?: string;
    proof_url?: string | null;
    proof_mime?: string | null;
    proof_name?: string | null;
  }) => Promise<void>;
}) {
  const typesFn = useServerFn(listActiveLeaveTypes);
  const { data: types = [] } = useQuery({ queryKey: ["active-leave-types"], queryFn: () => typesFn() });
  const [type, setType] = useState("Annual Leave");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [paid, setPaid] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [proof, setProof] = useState<{ name: string; mime: string; dataUrl: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedType = (types as any[]).find((tp) => tp.name === type);
  const requiresProof = !!selectedType?.requires_proof;
  const MAX_PROOF = 1.5 * 1024 * 1024;
  const ALLOWED_PROOF = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

  async function onProof(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_PROOF.includes(f.type)) {
      setErr("Only PDF, PNG, or JPEG files are allowed.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_PROOF) {
      setErr("File must be 1.5 MB or smaller.");
      e.target.value = "";
      return;
    }
    setErr(null);
    const reader = new FileReader();
    reader.onload = () => setProof({ name: f.name, mime: f.type, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  }

  function days(a: string, b: string) {
    if (!a || !b) return 0;
    return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!start || !end) return setErr("Start and end dates are required.");
    const rangeErr = validateDateRange(start, end, { required: true, label: { from: "Start", to: "End" } });
    if (rangeErr) return setErr(rangeErr);
    if (requiresProof && !proof) return setErr("Medical proof is required for this leave type.");

    setSubmitting(true);
    try {
      await onSubmit({
        leave_type_id: selectedType?.id ?? null,
        leave_type_name: type,
        start_date: start,
        end_date: end,
        days: days(start, end),
        paid,
        reason: reason.trim() || undefined,
        proof_url: proof?.dataUrl ?? null,
        proof_mime: proof?.mime ?? null,
        proof_name: proof?.name ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-xs p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-brand" />
            <h2 className="font-display text-lg font-bold">New Leave Request</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Leave Type</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                const sel = (types as any[]).find((tp) => tp.name === e.target.value);
                if (sel) setPaid(!!sel.paid);
              }}
              className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            >
              {(types as any[]).length === 0 && <option value={type}>{type}</option>}
              {(types as any[]).map((tp) => (
                <option key={tp.id} value={tp.name}>
                  {tp.name}
                </option>
              ))}
            </select>
          </div>

          <DateRangeField
            from={start}
            to={end}
            onFromChange={setStart}
            onToChange={setEnd}
            fromLabel="Start Date"
            toLabel="End Date"
            error={validateDateRange(start, end)}
          />

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason (Optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm resize-none focus:border-brand focus:outline-none"
              placeholder="Provide context for your manager or HR..."
            />
          </div>

          {requiresProof && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Proof Document (PDF, PNG, JPG, max 1.5 MB)
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg"
                onChange={onProof}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{proof ? "Replace attachment" : "Attach proof"}</span>
                </button>
                {proof && (
                  <span className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> {proof.name}
                  </span>
                )}
              </div>
            </div>
          )}

          {err && <p className="rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">{err}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-brand hover:opacity-95 disabled:opacity-50 transition"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Submit Request</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}