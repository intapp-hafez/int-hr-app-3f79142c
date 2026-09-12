import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock,
  Briefcase,
  Route as RouteIcon,
  Coffee,
  Play,
  CheckCircle2,
  MapPin,
  Send,
  Loader2,
  Calendar,
  X,
  AlertCircle,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  getEmployeeDailyWorkday,
  startTravel as startTravelFn,
  completeTravel as completeTravelFn,
  type WorkdayTimelineItem,
} from "@/backend/functions/workday.functions";
import { transitionTask as transitionTaskFn } from "@/backend/functions/tasks.functions";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function MyWorkdayTimeline({ employeeId }: { employeeId?: string }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const isAr = lang === "ar";

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  const getWorkdayFn = useServerFn(getEmployeeDailyWorkday);
  const startTravelServerFn = useServerFn(startTravelFn);
  const completeTravelServerFn = useServerFn(completeTravelFn);
  const transitionTaskServerFn = useServerFn(transitionTaskFn);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["employee-workday", employeeId, selectedDate],
    queryFn: () => getWorkdayFn({ data: { employeeId, date: selectedDate } }),
    refetchInterval: isToday ? 30000 : false,
  });

  const [travelModalOpen, setTravelModalOpen] = useState(false);
  const [toLocation, setToLocation] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [relatedTaskId, setRelatedTaskId] = useState("");
  const [travelNote, setTravelNote] = useState("");

  const [liveLocation, setLiveLocation] = useState<{ lat?: number; lng?: number; city?: string; district?: string }>({});

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          try {
            const geo = await reverseGeocodeCoords(lat, lng);
            setLiveLocation({ lat, lng, city: geo.city, district: geo.district });
            if (!fromLocation) {
              const currentLoc = [geo.district, geo.city].filter(Boolean).join(", ");
              if (currentLoc) setFromLocation(currentLoc);
            }
          } catch {
            setLiveLocation({ lat, lng });
          }
        },
        () => {},
        { timeout: 5000, maximumAge: 60000 },
      );
    }
  }, [travelModalOpen]);

  const startTravelMut = useMutation({
    mutationFn: (payload: { to_location: string; from_location?: string; related_task_id?: string; note?: string; lat?: number; lng?: number; city?: string; district?: string }) =>
      startTravelServerFn({ data: payload }),
    onSuccess: () => {
      toast.success(isAr ? "تم بدء الانتقال" : "Travel started");
      setTravelModalOpen(false);
      setToLocation("");
      setTravelNote("");
      refetch();
      qc.invalidateQueries({ queryKey: ["tasks-db"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "فشل بدء الانتقال" : "Failed to start travel"));
    },
  });

  const completeTravelMut = useMutation({
    mutationFn: (payload: { to_location?: string; note?: string; lat?: number; lng?: number; city?: string; district?: string }) =>
      completeTravelServerFn({ data: payload }),
    onSuccess: () => {
      toast.success(isAr ? "تم إنهاء الانتقال والوصول بنجاح" : "Arrived / Travel completed");
      refetch();
      qc.invalidateQueries({ queryKey: ["tasks-db"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "فشل إنهاء الانتقال" : "Failed to complete travel"));
    },
  });

  const finishTaskMut = useMutation({
    mutationFn: (vars: { id: string; lat?: number; lng?: number }) =>
      transitionTaskServerFn({ data: { id: vars.id, status: "done", lat: vars.lat, lng: vars.lng } }),
    onSuccess: () => {
      toast.success(isAr ? "تم إكمال المهمة بنجاح" : "Task completed successfully");
      refetch();
      qc.invalidateQueries({ queryKey: ["tasks-db"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "فشل إكمال المهمة" : "Failed to complete task"));
    },
  });

  const metrics = data?.metrics || {
    attendance_minutes: 0,
    task_minutes: 0,
    travel_minutes: 0,
    break_minutes: 0,
  };

  const activeState = data?.active_state;
  const timeline = data?.timeline || [];

  return (
    <div className="space-y-4">
      {/* Header & Date Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            {isAr ? "يوم عملي والمخطط الزمني" : "My Workday & Daily Timeline"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "متابعة الحضور، وقت تنفيذ المهام، وأوقات الانتقال بين المواقع"
              : "Track attendance, active task execution, and travel time between sites"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-hidden"
            />
          </div>

          {isToday && (
            <button
              type="button"
              disabled={activeState?.type === "travel"}
              onClick={() => setTravelModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 disabled:opacity-50"
            >
              <RouteIcon className="h-3.5 w-3.5" />
              {isAr ? "بدء انتقال" : "Start Travel"}
            </button>
          )}
        </div>
      </div>

      {/* Active Activity Hero Banner (if on task or traveling) */}
      {isToday && activeState && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 shadow-soft transition-all ${
            activeState.type === "task"
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              : "border border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                activeState.type === "task"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-sky-500 text-white shadow-xs"
              }`}
            >
              {activeState.type === "task" ? (
                <Briefcase className="h-5 w-5 animate-pulse" />
              ) : (
                <RouteIcon className="h-5 w-5 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {activeState.type === "task"
                    ? isAr ? "جاري العمل على مهمة" : "Task in Progress"
                    : isAr ? "جاري الانتقال" : "Travel in Progress"}
                </span>
                <span className="font-mono text-xs font-semibold">
                  {formatMinutes(activeState.elapsed_minutes)}
                </span>
              </div>
              <p className="mt-0.5 text-sm font-semibold">{activeState.title}</p>
              {activeState.location && (
                <p className="flex items-center gap-1 text-xs opacity-80">
                  <MapPin className="h-3 w-3" /> {activeState.location}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeState.type === "task" ? (
              <button
                type="button"
                disabled={finishTaskMut.isPending}
                onClick={() =>
                  finishTaskMut.mutate({
                    id: activeState.id,
                    lat: liveLocation.lat,
                    lng: liveLocation.lng,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {finishTaskMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {isAr ? "إنهاء المهمة" : "Finish Task"}
              </button>
            ) : (
              <button
                type="button"
                disabled={completeTravelMut.isPending}
                onClick={() =>
                  completeTravelMut.mutate({
                    to_location: activeState.location || activeState.title,
                    lat: liveLocation.lat,
                    lng: liveLocation.lng,
                    city: liveLocation.city,
                    district: liveLocation.district,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {completeTravelMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Flag className="h-3.5 w-3.5" />
                )}
                {isAr ? "تأكيد الوصول / إنهاء الانتقال" : "Arrived / Complete Travel"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4 Time Breakdown Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Attendance */}
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isAr ? "الحضور" : "Attendance"}</span>
            <Clock className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-2 text-lg font-bold tracking-tight text-foreground">
            {formatMinutes(metrics.attendance_minutes)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {data?.attendance.in_time
              ? `${new Date(data.attendance.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ${data.attendance.out_time ? `→ ${new Date(data.attendance.out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : `(${isAr ? "مستمر" : "Active"})`}`
              : isAr ? "لم يسجل حضور" : "Not clocked in"}
          </p>
        </div>

        {/* Task Time */}
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isAr ? "وقت المهام" : "Task Time"}</span>
            <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatMinutes(metrics.task_minutes)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isAr ? "العمل المباشر" : "Direct task work"}
          </p>
        </div>

        {/* Travel Time */}
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isAr ? "وقت الانتقال" : "Travel Time"}</span>
            <RouteIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="mt-2 text-lg font-bold tracking-tight text-sky-600 dark:text-sky-400">
            {formatMinutes(metrics.travel_minutes)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isAr ? "بين الفروع والمواقع" : "Between branches"}
          </p>
        </div>

        {/* Break / Other */}
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isAr ? "استراحة / أخرى" : "Break / Other"}</span>
            <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {formatMinutes(metrics.break_minutes)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isAr ? "وقت غير مهام" : "Non-task time"}
          </p>
        </div>
      </div>

      {/* Chronological Daily Timeline */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h3 className="mb-4 font-display text-sm font-semibold">
          {isAr ? "المخطط الزمني لليوم" : "Daily Activity Timeline"}
        </h3>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
            {isAr ? "جاري تحميل المخطط الزمني…" : "Loading timeline…"}
          </div>
        ) : timeline.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
            {isAr
              ? "لا توجد أنشطة مسجلة لهذا اليوم حتى الآن."
              : "No activities recorded for this date yet."}
          </div>
        ) : (
          <ol className="relative ms-3 space-y-4 border-s-2 border-border/80 ps-5">
            {timeline.map((item) => {
              const itemTime = new Date(item.time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              let iconBg = "bg-muted text-foreground";
              let iconElement = <Clock className="h-3.5 w-3.5" />;

              if (item.type === "sign_in" || item.type === "sign_out") {
                iconBg = "bg-brand text-brand-foreground";
                iconElement = <Clock className="h-3.5 w-3.5" />;
              } else if (item.type === "start_task") {
                iconBg = "bg-emerald-500 text-white";
                iconElement = <Play className="h-3.5 w-3.5" />;
              } else if (item.type === "complete_task") {
                iconBg = "bg-emerald-600 text-white";
                iconElement = <CheckCircle2 className="h-3.5 w-3.5" />;
              } else if (item.type === "start_travel") {
                iconBg = "bg-sky-500 text-white";
                iconElement = <RouteIcon className="h-3.5 w-3.5" />;
              } else if (item.type === "complete_travel") {
                iconBg = "bg-sky-600 text-white";
                iconElement = <Flag className="h-3.5 w-3.5" />;
              }

              return (
                <li key={item.id} className="relative">
                  {/* Node icon */}
                  <span
                    className={`absolute -start-[31px] top-1 grid h-6 w-6 place-items-center rounded-full shadow-xs ${iconBg}`}
                  >
                    {iconElement}
                  </span>

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.title}</p>
                      {item.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> {item.location}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-1 rounded-lg bg-muted/40 px-2 py-0.5 text-[11px] italic text-muted-foreground">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                        {itemTime}
                      </span>
                      {item.duration_minutes != null && item.duration_minutes > 0 && (
                        <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                          {formatMinutes(item.duration_minutes)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Modal: Start Travel */}
      {travelModalOpen && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4"
          onClick={() => setTravelModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-3xl bg-background p-6 shadow-soft"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <RouteIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold">
                    {isAr ? "بدء نشاط انتقال" : "Start Travel Activity"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "تسجيل وقت الانتقال بين المواقع" : "Record transit time between sites"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTravelModalOpen(false)}
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="mb-1 block font-medium text-muted-foreground">
                  {isAr ? "من موقع (نقطة الانطلاق)" : "From Location"}
                </span>
                <input
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  placeholder={isAr ? "مثال: المقر الرئيسي - المعادي" : "e.g., Cairo HQ - Maadi"}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-medium text-foreground">
                  {isAr ? "إلى موقع (الوجهة) *" : "Destination / To Location *"}
                </span>
                <input
                  required
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  placeholder={isAr ? "مثال: فرع الإسكندرية / موقع العميل" : "e.g., Alex Branch / Client Site"}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium"
                />
              </label>

              {data?.tasks && data.tasks.length > 0 && (
                <label className="block">
                  <span className="mb-1 block font-medium text-muted-foreground">
                    {isAr ? "مرتبط بمهمة (اختياري)" : "Related Task (Optional)"}
                  </span>
                  <select
                    value={relatedTaskId}
                    onChange={(e) => setRelatedTaskId(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="">{isAr ? "— بدون مهمة محددة —" : "— None —"}</option>
                    {data.tasks.map((tk) => (
                      <option key={tk.id} value={tk.id}>
                        {tk.title} ({tk.status})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="mb-1 block font-medium text-muted-foreground">
                  {isAr ? "ملاحظات إضافية (اختياري)" : "Notes (Optional)"}
                </span>
                <input
                  value={travelNote}
                  onChange={(e) => setTravelNote(e.target.value)}
                  placeholder={isAr ? "وسيلة المواصلات أو سبب الانتقال…" : "Transit details or purpose…"}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setTravelModalOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={!toLocation.trim() || startTravelMut.isPending}
                onClick={() =>
                  startTravelMut.mutate({
                    from_location: fromLocation.trim() || undefined,
                    to_location: toLocation.trim(),
                    related_task_id: relatedTaskId || undefined,
                    note: travelNote.trim() || undefined,
                    lat: liveLocation.lat,
                    lng: liveLocation.lng,
                    city: liveLocation.city,
                    district: liveLocation.district,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {startTravelMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isAr ? "بدء الانتقال الآن" : "Start Travel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
