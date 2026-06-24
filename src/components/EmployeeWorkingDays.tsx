import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, Loader2, Trash2 } from "lucide-react";
import {
  getEmployeeWorkingDays,
  setEmployeeWorkingDaysWeekly,
  setEmployeeWorkingDaysMonth,
  clearEmployeeWorkingDaysMonth,
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

function toggle(set: number[], n: number): number[] {
  return set.includes(n) ? set.filter((x) => x !== n) : [...set, n].sort();
}

function ymKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function EmployeeWorkingDays({ employeeId }: { employeeId: string }) {
  const getFn = useServerFn(getEmployeeWorkingDays);
  const saveWeeklyFn = useServerFn(setEmployeeWorkingDaysWeekly);
  const saveMonthFn = useServerFn(setEmployeeWorkingDaysMonth);
  const clearMonthFn = useServerFn(clearEmployeeWorkingDaysMonth);

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
  }, [ym, data]);

  async function saveWeekly() {
    setBusy("weekly");
    try {
      await saveWeeklyFn({ data: { employee_id: employeeId, days: weekly } });
      toast.success("Weekly working days saved");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  async function saveMonth() {
    setBusy("month");
    try {
      const [y, m] = ym.split("-").map(Number);
      await saveMonthFn({ data: { employee_id: employeeId, year: y, month: m, days: monthDays } });
      toast.success("Month override saved");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  async function clearMonth() {
    setBusy("month-clear");
    try {
      const [y, m] = ym.split("-").map(Number);
      await clearMonthFn({ data: { employee_id: employeeId, year: y, month: m } });
      toast.success("Override removed — falls back to weekly pattern");
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
        <h3 className="font-display text-sm font-semibold">Working days</h3>
        <p className="text-[11px] text-muted-foreground">
          Default weekday pattern, plus optional month-specific overrides (e.g. allow Fridays in one month only).
        </p>
      </header>

      {/* Weekly pattern */}
      <div className="border-b border-border px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Default weekly pattern</p>
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
                onClick={() => setWeekly((p) => toggle(p, d.idx))}
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
                onClick={() => setMonthDays((p) => toggle(p, d.idx))}
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
      </div>
    </section>
  );
}