import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { TrendingUp } from "lucide-react";
import { getAttendanceTrend } from "@/backend/functions/admin-dashboard-extras.functions";

type Range = "7d" | "14d" | "30d" | "90d";
type Granularity = "daily" | "weekly";

const RANGES: { id: Range; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "14d", label: "14 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

export function AttendanceTrendChart() {
  const [range, setRange] = useState<Range>("7d");
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const fn = useServerFn(getAttendanceTrend);
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-trend", range, granularity],
    queryFn: () => fn({ data: { range, granularity } }),
    refetchInterval: 60_000,
  });
  const series = data?.series ?? [];

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <TrendingUp className="h-4 w-4 text-brand" /> Attendance trend
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {granularity === "weekly" ? "Weekly averages" : "Daily breakdown"} • Present, Late, Absent
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  range === r.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5">
            {(["daily", "weekly"] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                  granularity === g ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-72 w-full">
        {isLoading ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">Loading chart…</div>
        ) : series.length === 0 ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">No data in this range.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success, 142 70% 45%))" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(var(--success, 142 70% 45%))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--warning, 38 92% 50%))" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(var(--warning, 38 92% 50%))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive, 0 84% 60%))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--destructive, 0 84% 60%))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={28} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="present" name="Present" stroke="hsl(var(--success, 142 70% 45%))" strokeWidth={2} fill="url(#gPresent)" />
              <Area type="monotone" dataKey="late" name="Late" stroke="hsl(var(--warning, 38 92% 50%))" strokeWidth={2} fill="url(#gLate)" />
              <Area type="monotone" dataKey="absent" name="Absent" stroke="hsl(var(--destructive, 0 84% 60%))" strokeWidth={2} fill="url(#gAbsent)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}