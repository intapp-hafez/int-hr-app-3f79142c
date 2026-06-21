import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download, FileText, FileSpreadsheet, FileBarChart2,
  TrendingUp, TrendingDown, Clock, UserX, Users, Timer, CheckCircle2, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

const reportTemplates = [
  { name: "Daily Attendance", desc: "Per-day breakdown by employee and branch", icon: FileBarChart2 },
  { name: "Monthly Attendance", desc: "Aggregate hours, late count, absences", icon: FileBarChart2 },
  { name: "Late Arrivals", desc: "Employees arriving after grace period", icon: Clock },
  { name: "Overtime", desc: "Hours worked beyond shift schedule", icon: Timer },
  { name: "Leave Summary", desc: "Leave usage by type and department", icon: FileSpreadsheet },
  { name: "Absence Report", desc: "Unexplained absences and patterns", icon: UserX },
];

const ranges = ["7d", "30d", "90d", "1y"] as const;
type Range = (typeof ranges)[number];

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useI18n();
  const employees = useStore((s) => s.employees);
  const locations = useStore((s) => s.locations);
  const leaves = useStore((s) => s.leaves);
  const [range, setRange] = useState<Range>("30d");
  const [branch, setBranch] = useState<string>("all");

  const filteredEmployees = useMemo(
    () => (branch === "all" ? employees : employees.filter((e) => e.branch === branch)),
    [employees, branch],
  );

  const trend = useMemo(() => generateTrend(range), [range]);
  const avg = Math.round(trend.reduce((a, b) => a + b.value, 0) / trend.length);
  const delta = trend[trend.length - 1].value - trend[0].value;

  const byBranch = locations.map((l) => {
    const headcount = employees.filter((e) => e.branch === l.name).length;
    return { name: l.name, headcount, rate: 70 + ((l.id * 7) % 25) };
  });
  const maxHeadcount = Math.max(1, ...byBranch.map((b) => b.headcount));

  const deptCounts = filteredEmployees.reduce<Record<string, number>>((acc, e) => {
    acc[e.dept] = (acc[e.dept] ?? 0) + 1; return acc;
  }, {});
  const depts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
  const deptTotal = depts.reduce((s, [, n]) => s + n, 0) || 1;

  const leaveByType = leaves.reduce<Record<string, number>>((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1; return acc;
  }, {});

  function handleExport(fmt: "PDF" | "Excel" | "CSV", name: string) {
    toast.success(`${name} exported`, { description: `${fmt} • ${branch === "all" ? "All branches" : branch} • ${range}` });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("reports")}</h1>
          <p className="text-sm text-muted-foreground">Export workforce data in PDF, Excel and CSV</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-full border border-border bg-card p-1 text-xs font-medium">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  range === r ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
          >
            <option value="all">All branches</option>
            {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>
      </div>

      {/* KPI grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={CheckCircle2} label="Attendance rate" value={`${avg}%`} delta={delta} suffix="pp" tone="brand" />
        <KpiCard icon={Clock} label="Avg late / day" value="2.4" delta={-0.6} suffix="" tone="warning" />
        <KpiCard icon={Timer} label="Overtime hrs" value="184" delta={+12} suffix="h" tone="brand" />
        <KpiCard icon={Users} label="Headcount" value={String(filteredEmployees.length)} delta={+1} suffix="" tone="muted" />
      </section>

      {/* Trend + Departments */}
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Attendance trend</h2>
              <p className="text-xs text-muted-foreground">{range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : range === "90d" ? "Last 12 weeks" : "Last 12 months"}</p>
            </div>
            <div className="text-end">
              <p className="font-display text-2xl font-semibold text-brand tabular-nums">{avg}%</p>
              <p className={`inline-flex items-center gap-1 text-[11px] font-semibold ${delta >= 0 ? "text-success" : "text-destructive"}`}>
                {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta >= 0 ? "+" : ""}{delta}pp
              </p>
            </div>
          </div>
          <div className="mt-6 flex h-44 items-end gap-1.5">
            {trend.map((p, i) => (
              <div key={i} className="group relative flex-1">
                <div
                  className="w-full rounded-t-lg bg-gradient-brand opacity-90 transition-all hover:opacity-100"
                  style={{ height: `${p.value}%` }}
                  title={`${p.label}: ${p.value}%`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>{trend[0].label}</span>
            <span>{trend[Math.floor(trend.length / 2)].label}</span>
            <span>{trend[trend.length - 1].label}</span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-base font-semibold">By department</h2>
          <p className="text-xs text-muted-foreground">{filteredEmployees.length} employees</p>
          <ul className="mt-5 space-y-3">
            {depts.map(([name, count]) => {
              const pct = Math.round((count / deptTotal) * 100);
              return (
                <li key={name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{name}</span>
                    <span className="tabular-nums text-muted-foreground">{count} · {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Branch breakdown + Leave types */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-base font-semibold">By branch</h2>
          <p className="text-xs text-muted-foreground">Headcount and attendance</p>
          <div className="mt-5 space-y-4">
            {byBranch.map((b) => (
              <div key={b.name}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium">{b.name}</span>
                  <span className="tabular-nums text-muted-foreground">{b.headcount} · {b.rate}%</span>
                </div>
                <div className="mt-1.5 flex h-2.5 gap-1">
                  <div className="rounded-full bg-gradient-brand" style={{ width: `${(b.headcount / maxHeadcount) * 60}%` }} />
                  <div className="rounded-full bg-success/40" style={{ width: `${b.rate * 0.4}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-base font-semibold">Leave types</h2>
          <p className="text-xs text-muted-foreground">{leaves.length} requests this period</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {Object.entries(leaveByType).map(([type, n]) => (
              <div key={type} className="rounded-2xl bg-muted/60 p-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />{type}
                </div>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{n}</p>
              </div>
            ))}
            {Object.keys(leaveByType).length === 0 && (
              <p className="col-span-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">No leave data.</p>
            )}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section>
        <h2 className="mb-3 font-display text-base font-semibold">Generate report</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reportTemplates.map((r) => (
            <div key={r.name} className="group rounded-3xl border border-border bg-card p-5 transition-shadow hover:shadow-soft">
              <div className="flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-accent-foreground">
                  <r.icon className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{range}</span>
              </div>
              <p className="mt-4 font-display text-base font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                <button onClick={() => handleExport("PDF", r.name)} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 font-semibold text-background">
                  <Download className="h-3 w-3" /> PDF
                </button>
                <button onClick={() => handleExport("Excel", r.name)} className="rounded-full bg-muted px-3 py-1.5 font-semibold hover:bg-accent">Excel</button>
                <button onClick={() => handleExport("CSV", r.name)} className="rounded-full bg-muted px-3 py-1.5 font-semibold hover:bg-accent">CSV</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent exports */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-base font-semibold">Recent exports</h2>
        <ul className="mt-3 divide-y divide-border">
          {recentExports.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-[11px] text-muted-foreground">{e.fmt} · {e.size} · {e.when}</p>
                </div>
              </div>
              <button className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted">Download</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, delta, suffix, tone,
}: { icon: typeof Users; label: string; value: string; delta: number; suffix: string; tone: "brand" | "warning" | "muted" }) {
  const positive = delta >= 0;
  const iconBg = tone === "brand" ? "bg-gradient-brand text-brand-foreground" : tone === "warning" ? "bg-warning/20 text-warning-foreground" : "bg-accent text-accent-foreground";
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${positive ? "text-success" : "text-destructive"}`}>
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? "+" : ""}{delta}{suffix}
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function generateTrend(range: Range): { label: string; value: number }[] {
  const seed = { "7d": 7, "30d": 30, "90d": 12, "1y": 12 }[range];
  const labels =
    range === "7d"  ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] :
    range === "30d" ? Array.from({ length: 30 }, (_, i) => `${i + 1}`) :
    range === "90d" ? Array.from({ length: 12 }, (_, i) => `W${i + 1}`) :
                       ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return Array.from({ length: seed }, (_, i) => {
    const base = 70 + Math.round(Math.sin((i / seed) * Math.PI * 2) * 8);
    const drift = Math.round((i / seed) * 10);
    return { label: labels[i] ?? `${i + 1}`, value: Math.min(98, base + drift) };
  });
}

const recentExports = [
  { id: 1, name: "Monthly Attendance — April 2026", fmt: "PDF", size: "412 KB", when: "2h ago" },
  { id: 2, name: "Late Arrivals — Last 30 days", fmt: "Excel", size: "88 KB", when: "Yesterday" },
  { id: 3, name: "Leave Summary — Q1 2026", fmt: "CSV", size: "24 KB", when: "3d ago" },
  { id: 4, name: "Overtime — Engineering", fmt: "PDF", size: "201 KB", when: "1w ago" },
];
