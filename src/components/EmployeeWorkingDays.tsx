import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, Loader2, Trash2, AlertCircle } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  getEmployeeWorkingDays,
  setEmployeeWorkingDaysWeekly,
  setEmployeeWorkingDaysMonth,
  clearEmployeeWorkingDaysMonth,
  setEmployeeWorkingDaysDates,
} from "@/backend/functions/employee-working-days.functions";

const WEEKDAYS = [
  { idx: 0, label: "Sun" },
  { idx: 1, label: "Mon" },
  { idx: 2, label: "Tue" },
  { idx: 3, label: "Wed" },
  { idx: 4, label: "Thu" },
  { idx: 5, label: "Fri" },
  { idx: 6, label: "Sat" },
];

const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

function toggle(set: number[], n: number): number[] {
  return set.includes(n) ? set.filter((x) => x !== n) : [...set, n].sort();
}

function ymKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function EmployeeWorkingDays({
  employeeId,
  isManager: isManagerProp,
}: {
  employeeId: string;
  isManager?: boolean;
}) {
  const session = useSession();
  const { isAr } = useI18n();

  // If explicitly flagged or if the logged-in session is a manager (and not admin/hr)
  const isManager =
    isManagerProp ??
    (session?.role === "manager" ||
      (Boolean(session?.roles?.includes("manager")) &&
        !session?.roles?.some((r) => ["admin", "hr"].includes(r))));

  const getFn = useServerFn(getEmployeeWorkingDays);
  const saveWeeklyFn = useServerFn(setEmployeeWorkingDaysWeekly);
  const saveMonthFn = useServerFn(setEmployeeWorkingDaysMonth);
  const clearMonthFn = useServerFn(clearEmployeeWorkingDaysMonth);
  const saveDatesFn = useServerFn(setEmployeeWorkingDaysDates);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["employee-working-days", employeeId],
    queryFn: () => getFn({ data: { employee_id: employeeId } }),
    enabled: !!employeeId,
  });

  const [weekly, setWeekly] = useState<number[]>([0, 1, 2, 3, 4]);
  const [busy, setBusy] = useState<string | null>(null);

  // Month picker (YYYY-MM)
  const today = new Date();
  const [ym, setYm] = useState<string>(ymKey(today.getFullYear(), today.getMonth() + 1));
  const [monthDays, setMonthDays] = useState<number[]>([]);
  const [monthExists, setMonthExists] = useState(false);
  // Per-date overrides (day-of-month numbers 1..31) for the currently selected ym.
  const [dateOn, setDateOn] = useState<number[]>([]);
  const [dateOff, setDateOff] = useState<number[]>([]);

  useEffect(() => {
    if (!data) return;
    setWeekly(data.weekly);
  }, [data]);

  // Sync month editor whenever ym or data changes
  useEffect(() => {
    if (!data) return;
    const [y, m] = ym.split("-").map(Number);
    const found = data.months.find((o: { year: number; month: number; days: number[] }) => o.year === y && o.month === m);
    if (found) {
      setMonthDays(found.days);
      setMonthExists(true);
    } else {
      setMonthDays(data.weekly);
      setMonthExists(false);
    }
    const on = (data as any).dateOn?.find((o: any) => o.year === y && o.month === m)?.days ?? [];
    const off = (data as any).dateOff?.find((o: any) => o.year === y && o.month === m)?.days ?? [];
    setDateOn(on);
    setDateOff(off);
  }, [ym, data]);

  async function saveWeekly() {
    if (isManager && weekly.length < 5) {
      toast.error(
        isAr
          ? "لا يمكن الحفظ: يجب تحديد 5 أيام عمل على الأقل أسبوعياً للمدير (بحد أقصى يومين إجازة أسبوعياً / 8 أيام شهرياً)"
          : "Cannot save: managers must maintain at least 5 working days per week (maximum 8 days off per month).",
      );
      return;
    }
    setBusy("weekly");
    try {
      await saveWeeklyFn({ data: { employee_id: employeeId, days: weekly } });
      toast.success(isAr ? "تم حفظ النمط الأسبوعي" : "Weekly working days saved");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  const calendar = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startWeekday = first.getDay();
    const cells: Array<{ day: number | null; weekday: number; isToday: boolean }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ day: null, weekday: i, isToday: false });
    const t = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const wd = new Date(y, m - 1, d).getDay();
      const isToday = t.getFullYear() === y && t.getMonth() + 1 === m && t.getDate() === d;
      cells.push({ day: d, weekday: wd, isToday });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, weekday: cells.length % 7, isToday: false });
    return cells;
  }, [ym]);

  const allowedCount = useMemo(
    () =>
      calendar.filter((c) => {
        if (c.day === null) return false;
        if (dateOn.includes(c.day)) return true;
        if (dateOff.includes(c.day)) return false;
        return monthDays.includes(c.weekday);
      }).length,
    [calendar, monthDays, dateOn, dateOff],
  );
  const totalDays = useMemo(() => calendar.filter((c) => c.day !== null).length, [calendar]);
  const offCount = totalDays - allowedCount;

  async function saveMonth() {
    if (isManager && offCount > 8) {
      toast.error(
        isAr
          ? `لا يمكن الحفظ: لا يمكن للمدير تحديد أكثر من 8 أيام إجازة في الشهر (حالياً ${offCount} أيام إجازة)`
          : `Cannot save: managers cannot select more than 8 days off per month (currently ${offCount} days off).`,
      );
      return;
    }
    setBusy("month");
    try {
      const [y, m] = ym.split("-").map(Number);
      await saveMonthFn({
        data: {
          employee_id: employeeId,
          year: y,
          month: m,
          days: monthDays,
          on_days: dateOn,
          off_days: dateOff,
        },
      });
      await saveDatesFn({
        data: { employee_id: employeeId, year: y, month: m, on_days: dateOn, off_days: dateOff },
      });
      toast.success(isAr ? "تم حفظ جدول الشهر" : "Month override saved");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  async function clearMonth() {
    if (isManager) {
      const fallbackAllowed = calendar.filter((c) => c.day !== null && weekly.includes(c.weekday)).length;
      const fallbackOff = totalDays - fallbackAllowed;
      if (fallbackOff > 8) {
        toast.error(
          isAr
            ? `لا يمكن إلغاء التخصيص: النمط الأسبوعي ينتج عنه ${fallbackOff} أيام إجازة في هذا الشهر (الحد الأقصى للمدير 8 أيام)`
            : `Cannot remove override: weekly pattern results in ${fallbackOff} days off in this month (limit is 8 for managers).`,
        );
        return;
      }
    }
    setBusy("month-clear");
    try {
      const [y, m] = ym.split("-").map(Number);
      await clearMonthFn({ data: { employee_id: employeeId, year: y, month: m } });
      toast.success(isAr ? "تمت إزالة التخصيص — العودة للنمط الأسبوعي" : "Override removed — falls back to weekly pattern");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove");
    } finally {
      setBusy(null);
    }
  }

  const monthLabel = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [ym]);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    for (let i = 0; i < 15; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      opts.push({
        value: ymKey(d.getFullYear(), d.getMonth() + 1),
        label: d.toLocaleString(undefined, { month: "long", year: "numeric" }),
      });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold">Working days</h3>
          {isManager && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {isAr ? "الحد الأقصى للمدير: 8 أيام إجازة/شهر" : "Manager rule: max 8 days off/mo"}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Default weekday pattern, plus optional month-specific overrides (e.g. allow Fridays in one month only).
        </p>
        {data && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">Active weekdays:</span>
            <span className="font-medium text-foreground">
              {weekly.length === 0
                ? "None"
                : WEEKDAYS.filter((d) => weekly.includes(d.idx)).map((d) => d.label).join(", ")}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {data.months.length === 0
                ? "No month overrides"
                : `${data.months.length} month override${data.months.length === 1 ? "" : "s"}: ${data.months
                    .map((o: { year: number; month: number }) =>
                      new Date(o.year, o.month - 1, 1).toLocaleString(undefined, { month: "short", year: "2-digit" }),
                    )
                    .join(", ")}`}
            </span>
          </div>
        )}
      </header>

      {/* Weekly pattern */}
      <div className="border-b border-border px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-foreground">Default weekly pattern</p>
            {isManager && (
              <p className="text-[10px] text-muted-foreground">
                {isAr ? "يجب اختيار 5 أيام عمل على الأقل أسبوعياً" : "Managers must select at least 5 working days/week"}
              </p>
            )}
          </div>
          <button
            onClick={saveWeekly}
            disabled={busy === "weekly" || isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
          >
            {busy === "weekly" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const on = weekly.includes(d.idx);
            return (
              <button
                key={d.idx}
                type="button"
                onClick={() => {
                  const nextWeekly = toggle(weekly, d.idx);
                  if (isManager && nextWeekly.length < 5) {
                    toast.error(
                      isAr
                        ? "يجب تحديد 5 أيام عمل على الأقل أسبوعياً للمدير (بحد أقصى يومين إجازة أسبوعياً / 8 أيام شهرياً)"
                        : "Managers must maintain at least 5 working days per week (max 8 days off per month).",
                    );
                    return;
                  }
                  setWeekly(nextWeekly);
                }}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition " +
                  (on
                    ? "border-transparent bg-gradient-brand text-brand-foreground shadow-brand"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50")
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-month override */}
      <div className="px-4 py-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-foreground">Month override</p>
            <select
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">
              {monthExists ? "override active" : "using weekly pattern"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {monthExists && (
              <button
                onClick={clearMonth}
                disabled={busy === "month-clear"}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 disabled:opacity-60"
              >
                {busy === "month-clear" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove override
              </button>
            )}
            <button
              onClick={saveMonth}
              disabled={busy === "month" || isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
            >
              {busy === "month" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save {monthLabel}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const on = monthDays.includes(d.idx);
            return (
              <button
                key={d.idx}
                type="button"
                onClick={() => {
                  const nextMonthDays = toggle(monthDays, d.idx);
                  if (isManager) {
                    const nextAllowedCount = calendar.filter((c) => {
                      if (c.day === null) return false;
                      if (dateOn.includes(c.day)) return true;
                      if (dateOff.includes(c.day)) return false;
                      return nextMonthDays.includes(c.weekday);
                    }).length;
                    const nextOffCount = totalDays - nextAllowedCount;
                    if (nextOffCount > 8) {
                      toast.error(
                        isAr
                          ? `لا يمكن للمدير تحديد أكثر من 8 أيام إجازة في الشهر (هذا التحديد سينتج عنه ${nextOffCount} أيام إجازة)`
                          : `Managers cannot select more than 8 days off per month (this would result in ${nextOffCount} days off).`,
                      );
                      return;
                    }
                  }
                  setMonthDays(nextMonthDays);
                }}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition " +
                  (on
                    ? "border-transparent bg-gradient-brand text-brand-foreground shadow-brand"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50")
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tick a normally-off day (e.g. Fri) to let the employee work that day this month. Counts as a regular working day.
        </p>

        <div className="mt-4 mx-auto max-w-[320px] rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">{monthLabel}</p>
            <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-brand" /> Allowed
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-muted" /> Off
              </span>
              <span className="font-medium text-foreground">
                {allowedCount}/{totalDays}
              </span>
            </div>
          </div>

          {isManager && (
            <div className="mb-2.5 flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1.5 text-[11px]">
              <span className="text-muted-foreground">
                {isAr ? "إجازات الشهر (الحد الأقصى للمدير):" : "Month off days (manager limit):"}
              </span>
              <span
                className={`font-semibold ${
                  offCount > 8
                    ? "text-destructive"
                    : offCount === 8
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
                }`}
              >
                {offCount} / 8 {isAr ? "أيام" : "days"}{" "}
                {offCount === 8 ? (isAr ? "(الحد الأقصى)" : "(Max reached)") : offCount > 8 ? (isAr ? "(تجاوز الحد)" : "(Exceeds limit)") : ""}
              </span>
            </div>
          )}

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {WEEKDAY_SHORT.map((w, i) => (
              <div key={i} className="py-1">{w}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendar.map((c, i) => {
              if (c.day === null) return <div key={i} className="aspect-square" />;
              const forcedOn = dateOn.includes(c.day);
              const forcedOff = dateOff.includes(c.day);
              const baseAllowed = monthDays.includes(c.weekday);
              const allowed = forcedOn ? true : forcedOff ? false : baseAllowed;
              const overridden = forcedOn || forcedOff;
              const [yy, mm] = ym.split("-").map(Number);
              const title =
                new Date(yy, mm - 1, c.day).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }) +
                (allowed ? " — allowed" : " — not allowed") +
                (overridden ? " (per-date override — click to reset)" : " — click to toggle this date") +
                (isManager && allowed && offCount >= 8 ? (isAr ? " — (تم بلوغ الحد الأقصى 8 أيام إجازة)" : " — (Max 8 days off reached)") : "");
              return (
                <button
                  key={i}
                  type="button"
                  title={title}
                  onClick={() => {
                    // Tri-state cycle for this SPECIFIC date only:
                    //  overridden → clear override (back to weekday pattern)
                    //  base allowed → force OFF just this day
                    //  base not allowed → force ON just this day
                    let nextOn = dateOn;
                    let nextOff = dateOff;
                    if (overridden) {
                      nextOn = dateOn.filter((d) => d !== c.day);
                      nextOff = dateOff.filter((d) => d !== c.day);
                    } else if (baseAllowed) {
                      nextOff = [...dateOff.filter((d) => d !== c.day), c.day!].sort((a, b) => a - b);
                    } else {
                      nextOn = [...dateOn.filter((d) => d !== c.day), c.day!].sort((a, b) => a - b);
                    }

                    if (isManager) {
                      const nextAllowed = calendar.filter((item) => {
                        if (item.day === null) return false;
                        if (nextOn.includes(item.day)) return true;
                        if (nextOff.includes(item.day)) return false;
                        return monthDays.includes(item.weekday);
                      }).length;
                      const nextOffDays = totalDays - nextAllowed;
                      if (nextOffDays > 8) {
                        toast.error(
                          isAr
                            ? "لا يمكن للمدير تحديد أكثر من 8 أيام إجازة في الشهر (تم الوصول للحد الأقصى 8 أيام)"
                            : "Managers cannot select more than 8 days off per month (maximum 8 days off reached).",
                        );
                        return;
                      }
                    }

                    setDateOn(nextOn);
                    setDateOff(nextOff);
                  }}
                  className={
                    "flex aspect-square items-center justify-center rounded-md border text-[11px] font-medium transition hover:scale-[1.04] hover:shadow-sm active:scale-95 " +
                    (allowed
                      ? "border-transparent bg-gradient-brand text-brand-foreground shadow-brand"
                      : "border-border bg-muted/40 text-muted-foreground line-through opacity-70 hover:opacity-100") +
                    (c.isToday ? " ring-2 ring-ring ring-offset-1 ring-offset-background" : "") +
                    (overridden ? " outline outline-2 outline-offset-[-2px] outline-amber-400" : "")
                  }
                >
                  {c.day}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tap a specific date to force it ON or OFF for just that day.
            <span className="ml-1 inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm outline outline-2 outline-offset-[-2px] outline-amber-400" />
              amber outline = per-date override; tap again to clear.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
