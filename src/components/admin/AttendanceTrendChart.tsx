import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
} from "recharts";
import {
  TrendingUp,
  UserCheck,
  Clock,
  UserX,
  Percent,
  Layers,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { getAttendanceTrend } from "@/backend/functions/admin-dashboard-extras.functions";

type Range = "7d" | "14d" | "30d" | "90d";
type Granularity = "daily" | "weekly";
type ViewMode = "attendees" | "rate" | "stacked";

const RANGES: { id: Range; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "14d", label: "14 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

export function AttendanceTrendChart() {
  const [range, setRange] = useState<Range>("7d");
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [viewMode, setViewMode] = useState<ViewMode>("attendees");
  const [visible, setVisible] = useState({
    present: true,
    late: true,
    absent: true,
  });

  const fn = useServerFn(getAttendanceTrend);
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-trend", range, granularity],
    queryFn: () => fn({ data: { range, granularity } }),
    refetchInterval: 60_000,
  });

  const rawSeries = data?.series ?? [];
  const totalEmployees = data?.totalEmployees ?? 0;

  const series = useMemo(() => {
    return rawSeries.map((s: any) => {
      const staff = totalEmployees > 0 ? totalEmployees : s.present + s.late + s.absent;
      const rate = staff > 0 ? Math.round(((s.present + s.late) / staff) * 100) : 0;
      return {
        ...s,
        staff,
        rate,
        labelFormatted: s.label || (s.date ? s.date.slice(5) : ""),
      };
    });
  }, [rawSeries, totalEmployees]);

  const stats = useMemo(() => {
    if (!series.length) return { avgPresent: 0, avgLate: 0, avgAbsent: 0, avgRate: 0 };
    const totalP = series.reduce((acc, c) => acc + (c.present || 0), 0);
    const totalL = series.reduce((acc, c) => acc + (c.late || 0), 0);
    const totalA = series.reduce((acc, c) => acc + (c.absent || 0), 0);
    const totalR = series.reduce((acc, c) => acc + (c.rate || 0), 0);
    const len = series.length;
    return {
      avgPresent: Math.round(totalP / len),
      avgLate: Math.round(totalL / len),
      avgAbsent: Math.round(totalA / len),
      avgRate: Math.round(totalR / len),
    };
  }, [series]);

  const toggleMetric = (key: "present" | "late" | "absent") => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft transition-all">
      {/* Header section */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold leading-tight text-foreground">
                Attendance Trend
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {viewMode === "rate"
                  ? "Daily attendance percentage overview"
                  : viewMode === "attendees"
                  ? "Active check-ins (Present & Late)"
                  : "Full workforce breakdown (Present, Late, Absent)"}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode + Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setViewMode("attendees")}
              title="Focus on attendees"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                viewMode === "attendees"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="h-3 w-3 text-emerald-500" />
              Attendees
            </button>
            <button
              onClick={() => setViewMode("rate")}
              title="Attendance percentage rate"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                viewMode === "rate"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Percent className="h-3 w-3 text-brand" />
              Rate %
            </button>
            <button
              onClick={() => setViewMode("stacked")}
              title="Stacked workforce breakdown"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                viewMode === "stacked"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3 w-3 text-indigo-500" />
              Breakdown
            </button>
          </div>

          {/* Time Range Pills */}
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  range === r.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Daily / Weekly toggle */}
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5">
            {(["daily", "weekly"] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                  granularity === g
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mini Stat Summary Row */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Present</p>
            <p className="font-display text-sm font-semibold text-foreground tabular-nums">
              {stats.avgPresent} <span className="text-[10px] font-normal text-muted-foreground">/ day</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Late</p>
            <p className="font-display text-sm font-semibold text-foreground tabular-nums">
              {stats.avgLate} <span className="text-[10px] font-normal text-muted-foreground">/ day</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <UserX className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Absent</p>
            <p className="font-display text-sm font-semibold text-foreground tabular-nums">
              {stats.avgAbsent} <span className="text-[10px] font-normal text-muted-foreground">/ day</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/15 text-brand">
            <Percent className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Rate</p>
            <p className="font-display text-sm font-semibold text-brand tabular-nums">
              {stats.avgRate}%
            </p>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full">
        {isLoading ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground animate-pulse">
            Loading attendance trend…
          </div>
        ) : series.length === 0 ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            No attendance data available in this time range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: -10, right: 8, top: 12, bottom: 0 }}>
              <defs>
                {/* Present Emerald Gradient */}
                <linearGradient id="gradientPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>

                {/* Late Amber Gradient */}
                <linearGradient id="gradientLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>

                {/* Absent Rose Gradient */}
                <linearGradient id="gradientAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                </linearGradient>

                {/* Rate Brand Gradient */}
                <linearGradient id="gradientRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />

              <XAxis
                dataKey="labelFormatted"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1", strokeOpacity: 0.3 }}
                dy={6}
              />

              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                domain={viewMode === "rate" ? [0, 100] : ["auto", "auto"]}
                unit={viewMode === "rate" ? "%" : ""}
                width={36}
              />

              <Tooltip content={<CustomTooltip viewMode={viewMode} />} />

              {viewMode === "rate" ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="rate"
                    name="Attendance Rate"
                    stroke="#ea580c"
                    strokeWidth={2.5}
                    fill="url(#gradientRate)"
                    activeDot={{ r: 5, fill: "#ea580c", stroke: "#ffffff", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#ea580c"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#ea580c" }}
                  />
                </>
              ) : viewMode === "stacked" ? (
                <>
                  {visible.absent && (
                    <Area
                      type="monotone"
                      dataKey="absent"
                      name="Absent"
                      stackId="workforce"
                      stroke="#f43f5e"
                      strokeWidth={1.5}
                      fill="url(#gradientAbsent)"
                    />
                  )}
                  {visible.late && (
                    <Area
                      type="monotone"
                      dataKey="late"
                      name="Late"
                      stackId="workforce"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#gradientLate)"
                    />
                  )}
                  {visible.present && (
                    <Area
                      type="monotone"
                      dataKey="present"
                      name="Present"
                      stackId="workforce"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#gradientPresent)"
                    />
                  )}
                </>
              ) : (
                <>
                  {/* Attendees View: Present and Late clearly visible */}
                  {visible.present && (
                    <Area
                      type="monotone"
                      dataKey="present"
                      name="Present"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#gradientPresent)"
                      activeDot={{ r: 5, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  )}
                  {visible.late && (
                    <Area
                      type="monotone"
                      dataKey="late"
                      name="Late"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#gradientLate)"
                      activeDot={{ r: 4, fill: "#f59e0b", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  )}
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Interactive Legend Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        {viewMode === "rate" ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-brand" />
            <span className="font-medium text-foreground">Attendance Percentage</span>
            <span>(calculated daily against total active staff)</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button
              onClick={() => toggleMetric("present")}
              className={`inline-flex items-center gap-1.5 font-medium transition ${
                visible.present ? "text-foreground" : "text-muted-foreground opacity-50 line-through"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              Present
            </button>

            <button
              onClick={() => toggleMetric("late")}
              className={`inline-flex items-center gap-1.5 font-medium transition ${
                visible.late ? "text-foreground" : "text-muted-foreground opacity-50 line-through"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              Late
            </button>

            {viewMode === "stacked" && (
              <button
                onClick={() => toggleMetric("absent")}
                className={`inline-flex items-center gap-1.5 font-medium transition ${
                  visible.absent ? "text-foreground" : "text-muted-foreground opacity-50 line-through"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                Absent
              </button>
            )}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground">
          Showing <span className="font-medium text-foreground">{series.length} data points</span> • Auto-refreshes every 60s
        </div>
      </div>
    </section>
  );
}

function CustomTooltip({ active, payload, label, viewMode }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="min-w-[190px] rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-1.5">
        <p className="font-semibold text-xs text-foreground font-mono">{item.date || label}</p>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand tabular-nums">
          {item.rate}% Rate
        </span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Present
          </span>
          <span className="font-semibold tabular-nums font-mono">{item.present}</span>
        </div>

        <div className="flex items-center justify-between gap-4 text-amber-600 dark:text-amber-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Late
          </span>
          <span className="font-semibold tabular-nums font-mono">{item.late}</span>
        </div>

        <div className="flex items-center justify-between gap-4 text-rose-600 dark:text-rose-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Absent
          </span>
          <span className="font-semibold tabular-nums font-mono">{item.absent}</span>
        </div>

        {item.staff > 0 && (
          <div className="mt-2 border-t border-border/50 pt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Workforce</span>
            <span className="tabular-nums font-mono">{item.staff} staff</span>
          </div>
        )}
      </div>
    </div>
  );
}