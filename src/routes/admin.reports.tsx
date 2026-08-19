import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  Download, FileText, FileSpreadsheet, FileBarChart2,
  TrendingUp, TrendingDown, Clock, UserX, Users, Timer, CheckCircle2, Calendar, ChevronLeft, ChevronRight,
  CreditCard, FileClock
} from "lucide-react";
import { format, subMonths, addMonths } from "date-fns";
import { formatDate } from "@/lib/date-format";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminReportsData, getMonthlyAdvances } from "@/backend/functions/reports.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Banknote } from "lucide-react";

const reportTemplates = [
  { name: "Daily Attendance", desc: "Per-day breakdown by employee and branch", icon: FileBarChart2 },
  { name: "Monthly Attendance", desc: "Aggregate hours, late count, absences", icon: FileBarChart2 },
  { name: "Late Arrivals", desc: "Employees arriving after grace period", icon: Clock },
  { name: "Overtime", desc: "Hours worked beyond shift schedule", icon: Timer },
  { name: "Leave Summary", desc: "Leave usage by type and department", icon: FileSpreadsheet },
  { name: "Absence Report", desc: "Unexplained absences and patterns", icon: UserX },
];

const ranges = ["today", "yesterday", "thisMonth"] as const;
type Range = (typeof ranges)[number] | string;

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useI18n();
  const [range, setRange] = useState<Range>("thisMonth");
  const [branch, setBranch] = useState<string>("all");
  const [viewingReport, setViewingReport] = useState<string | null>(null);
  const [branchPage, setBranchPage] = useState(0);

  const currentMonth = format(new Date(), "yyyy-MM");
  const fetchAdvances = useServerFn(getMonthlyAdvances);
  const { data: advances = [], isLoading: advancesLoading } = useQuery({
    queryKey: ["monthly-advances", currentMonth],
    queryFn: () => fetchAdvances({ data: { month: currentMonth } }),
  });

  const fetchReports = useServerFn(getAdminReportsData);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", range, branch],
    queryFn: () => fetchReports({ data: { range, branch } })
  });

  const employees = data?.employees || [];
  const locations = data?.locations || [];
  const leaves = data?.leaves || [];
  const kpis = data?.kpis || { attendanceRate: 0, avgLate: "0.0", totalOvertimeHrs: 0, headcount: 0 };
  const tables = data?.tables || { daily: [], monthly: [], late: [], overtime: [], leaves: [], absence: [] };

  const filteredEmployees = employees; // Already filtered by backend

  const trend = useMemo(() => generateTrend(range), [range]);
  const avg = kpis.attendanceRate;
  const delta = trend[trend.length - 1].value - trend[0].value; // Still using mock trend for chart for now

  const byBranch = locations.map((l: any) => {
    const headcount = employees.filter((e: any) => e.city === l.name).length;
    return { name: l.name, headcount, rate: avg }; // Using avg rate for now
  }).filter((b: any) => branch === "all" || b.name === branch);
  const maxHeadcount = Math.max(1, ...byBranch.map((b) => b.headcount));

  const deptCounts = filteredEmployees.reduce<Record<string, number>>((acc, e: any) => {
    acc[e.dept] = (acc[e.dept] ?? 0) + 1; return acc;
  }, {});
  const depts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
  const deptTotal = depts.reduce((s, [, n]) => s + n, 0) || 1;

  const leaveByType = leaves.reduce<Record<string, number>>((acc, l: any) => {
    const t = l.leave_type_name || "Leave";
    acc[t] = (acc[t] ?? 0) + 1; return acc;
  }, {});

  function handleExport(fmt: "PDF" | "Excel" | "CSV", name: string) {
    let headers: string[] = [];
    let rows: any[][] = [];
    
    if (name === "Daily Attendance") {
      headers = ["Employee", "Branch", "Date", "Status"];
      rows = (tables.daily || []).map((r: any) => [r.employee, r.branch, r.date, r.status]);
    } else if (name === "Monthly Attendance") {
      headers = ["Employee", "Branch", "Days Present", "Days Absent", "Late Count"];
      rows = (tables.monthly || []).map((r: any) => [r.employee, r.branch, r.daysPresent, r.daysAbsent, r.lateCount]);
    } else if (name === "Late Arrivals") {
      headers = ["Employee", "Date", "Check-In Time", "Minutes Late"];
      rows = (tables.late || []).map((r: any) => [r.employee, r.date, r.checkInTime, r.minutesLate]);
    } else if (name === "Overtime") {
      headers = ["Employee", "Date", "Overtime Hours"];
      rows = (tables.overtime || []).map((r: any) => [r.employee, r.date, r.hours]);
    } else if (name === "Leave Summary") {
      headers = ["Employee", "Leave Type", "Start Date", "End Date", "Status"];
      rows = (tables.leaves || []).map((r: any) => [r.employee, r.type, r.start, r.end, r.status]);
    } else if (name === "Absence Report") {
      headers = ["Employee", "Date", "Note / Reason"];
      rows = (tables.absence || []).map((r: any) => [r.employee, r.date, r.reason]);
    }

    if (fmt === "Excel" || fmt === "CSV") {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${name.replace(/\s+/g, "_")}.${fmt === "Excel" ? "xlsx" : "csv"}`);
    } else if (fmt === "PDF") {
      const doc = new jsPDF();
      doc.text(`${name} - ${range.replace("month:", "")} (${branch})`, 14, 15);
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 20,
      });
      doc.save(`${name.replace(/\s+/g, "_")}.pdf`);
    }

    toast.success(`${fmt} downloaded`, { description: `${name} export complete.` });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("reports")}</h1>
          <p className="text-sm text-muted-foreground">Export workforce data in PDF, Excel and CSV</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-border bg-card p-1 text-xs font-medium">
              {ranges.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    range === r ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "today" ? "Today" : r === "yesterday" ? "Yesterday" : "This Month"}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-full border border-border bg-card px-2 py-1 text-xs font-medium h-[34px]">
              <button 
                onClick={() => setRange(`month:${format(subMonths(range.startsWith("month:") ? new Date(range.split(":")[1] + "-01T00:00:00") : new Date(), 1), "yyyy-MM")}`)}
                className="p-1 hover:bg-muted rounded-full"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <span className="px-2 min-w-[100px] text-center font-semibold">
                {range.startsWith("month:") ? format(new Date(range.split(":")[1] + "-01T00:00:00"), "MMMM yyyy") : format(new Date(), "MMMM yyyy")}
              </span>
              <button 
                onClick={() => setRange(`month:${format(addMonths(range.startsWith("month:") ? new Date(range.split(":")[1] + "-01T00:00:00") : new Date(), 1), "yyyy-MM")}`)}
                className="p-1 hover:bg-muted rounded-full"
              >
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
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
        {isLoading ? (
          <div className="col-span-4 p-8 text-center text-muted-foreground animate-pulse">Loading data...</div>
        ) : (
          <>
            <KpiCard icon={CheckCircle2} label="Attendance rate" value={`${kpis.attendanceRate}%`} delta={delta} suffix="pp" tone="brand" />
            <KpiCard icon={Clock} label="Avg late / day" value={String(kpis.avgLate)} delta={0} suffix="" tone="warning" />
            <KpiCard icon={Timer} label="Overtime hrs" value={String(kpis.totalOvertimeHrs)} delta={0} suffix="h" tone="brand" />
            <KpiCard icon={Users} label="Headcount" value={String(kpis.headcount)} delta={0} suffix="" tone="muted" />
          </>
        )}
      </section>

      {/* Trend + Departments */}
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Attendance trend</h2>
              <p className="text-xs text-muted-foreground">
                {range === "today" ? "Today" : range === "yesterday" ? "Yesterday" : range === "thisMonth" ? "This Month" : range.replace("month:", "")}
              </p>
            </div>
            <div className="text-end">
              <p className="font-display text-2xl font-semibold text-brand tabular-nums">{avg}%</p>
              <p className={`inline-flex items-center gap-1 text-[11px] font-semibold ${delta >= 0 ? "text-success" : "text-destructive"}`}>
                {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta >= 0 ? "+" : ""}{delta}pp
              </p>
            </div>
          </div>
          <div className="mt-6 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  dy={10}
                  minTickGap={20}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
                  }}
                  itemStyle={{ color: "#ea580c", fontWeight: 600 }}
                  formatter={(value: number) => [`${value}%`, "Attendance"]}
                  labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}
                />
                <Area type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">By branch</h2>
              <p className="text-xs text-muted-foreground">Headcount and attendance</p>
            </div>
            {byBranch.length > 6 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <button
                  onClick={() => setBranchPage(p => Math.max(0, p - 1))}
                  disabled={branchPage === 0}
                  className="p-1 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="tabular-nums font-medium min-w-[3rem] text-center">
                  {branchPage * 6 + 1}–{Math.min((branchPage + 1) * 6, byBranch.length)} of {byBranch.length}
                </span>
                <button
                  onClick={() => setBranchPage(p => Math.min(Math.ceil(byBranch.length / 6) - 1, p + 1))}
                  disabled={(branchPage + 1) * 6 >= byBranch.length}
                  className="p-1 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="mt-5 space-y-4">
            {byBranch.slice(branchPage * 6, branchPage * 6 + 6).map((b) => (
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
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                <button onClick={() => setViewingReport(r.name)} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 font-semibold text-brand-foreground hover:bg-brand/90 transition-colors shadow-sm">
                  <FileSpreadsheet className="h-3 w-3" /> View Data
                </button>
                <div className="flex-1" />
                <button onClick={() => handleExport("PDF", r.name)} className="rounded-full bg-muted px-2.5 py-1.5 font-semibold hover:bg-accent text-muted-foreground hover:text-foreground">PDF</button>
                <button onClick={() => handleExport("Excel", r.name)} className="rounded-full bg-muted px-2.5 py-1.5 font-semibold hover:bg-accent text-muted-foreground hover:text-foreground">Excel</button>
                <button onClick={() => handleExport("CSV", r.name)} className="rounded-full bg-muted px-2.5 py-1.5 font-semibold hover:bg-accent text-muted-foreground hover:text-foreground">CSV</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Employee Advance Payments */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-base font-semibold">Employee Advance Payments</h2>
            <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy")} · {advances.length} request{advances.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-brand-foreground">
              <Banknote className="h-4 w-4" />
            </span>
          </div>
        </div>
        {advancesLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">Loading advances...</div>
        ) : advances.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No advance requests this month.</div>
        ) : (
          <div className="overflow-auto max-h-72 rounded-2xl border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  <th className="px-4 py-2.5 text-start font-semibold text-muted-foreground">Request #</th>
                  <th className="px-4 py-2.5 text-start font-semibold text-muted-foreground">Employee</th>
                  <th className="px-4 py-2.5 text-end font-semibold text-muted-foreground">Requested</th>
                  <th className="px-4 py-2.5 text-end font-semibold text-muted-foreground">Approved</th>
                  <th className="px-4 py-2.5 text-start font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-start font-semibold text-muted-foreground">Repayment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {advances.map((a: any) => (
                  <tr key={a.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{a.requestNumber || "—"}</td>
                    <td className="px-4 py-2.5 font-medium">{a.employee}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{Number(a.requestedAmount).toLocaleString()} {a.currency}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">
                      {a.approvedAmount != null ? `${Number(a.approvedAmount).toLocaleString()} ${a.currency}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        a.status === "paid" ? "bg-success/15 text-success" :
                        a.status === "approved_for_payment" ? "bg-brand/10 text-brand" :
                        a.status === "rejected" ? "bg-destructive/10 text-destructive" :
                        a.status === "pending_manager" || a.status === "pending_hr" || a.status === "pending_finance" ? "bg-warning/10 text-warning-foreground" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {a.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        a.repaymentStatus === "completed" ? "bg-success/15 text-success" :
                        a.repaymentStatus === "active" ? "bg-brand/10 text-brand" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {a.repaymentStatus || "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Report Viewer Modal */}
      <ReportTableViewer 
        reportName={viewingReport} 
        onClose={() => setViewingReport(null)} 
        range={range} 
        setRange={setRange}
        branch={branch} 
        tables={tables}
        onExport={handleExport}
      />
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
  let seed = 30;
  let labels: string[] = [];

  if (range === "today" || range === "yesterday") {
    seed = 1;
    labels = ["Today"];
  } else if (range === "thisMonth" || range.startsWith("month:")) {
    seed = 30;
    labels = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
  } else {
    seed = { "7d": 7, "30d": 30, "90d": 12, "1y": 12 }[range as string] || 30;
    labels =
      range === "7d"  ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] :
      range === "30d" ? Array.from({ length: 30 }, (_, i) => `${i + 1}`) :
      range === "90d" ? Array.from({ length: 12 }, (_, i) => `W${i + 1}`) :
                        ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  }

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

function ReportTableViewer({ 
  reportName, 
  onClose, 
  range, 
  setRange,
  branch,
  tables,
  onExport
}: { 
  reportName: string | null; 
  onClose: () => void; 
  range: string; 
  setRange: (r: string) => void;
  branch: string; 
  tables: any;
  onExport: (fmt: "PDF" | "Excel" | "CSV", name: string) => void;
}) {
  if (!reportName) return null;

  let headers: string[] = [];
  let rows: React.ReactNode[][] = [];

  if (reportName === "Daily Attendance") {
    headers = ["Employee", "Branch", "Date", "Status"];
    rows = (tables.daily || []).map((r: any) => [r.employee, r.branch, r.date, r.status]);
  } else if (reportName === "Monthly Attendance") {
    headers = ["Employee", "Branch", "Days Present", "Days Absent", "Late Count"];
    rows = (tables.monthly || []).map((r: any) => [r.employee, r.branch, r.daysPresent, r.daysAbsent, r.lateCount]);
  } else if (reportName === "Late Arrivals") {
    headers = ["Employee", "Date", "Check-In Time", "Minutes Late"];
    rows = (tables.late || []).map((r: any) => [r.employee, r.date, r.checkInTime, r.minutesLate]);
  } else if (reportName === "Overtime") {
    headers = ["Employee", "Date", "Overtime Hours"];
    rows = (tables.overtime || []).map((r: any) => [r.employee, r.date, r.hours]);
  } else if (reportName === "Leave Summary") {
    headers = ["Employee", "Leave Type", "Start Date", "End Date", "Status"];
    rows = (tables.leaves || []).map((r: any) => [r.employee, r.type, r.start, r.end, r.status === "Approved" || r.status === "approved" ? "Approved" : r.status === "Rejected" || r.status === "rejected" ? "Rejected" : "Pending"]);
  } else if (reportName === "Absence Report") {
    headers = ["Employee", "Date", "Note / Reason"];
    rows = (tables.absence || []).map((r: any) => [r.employee, r.date, r.reason]);
  }

  return (
    <Dialog open={!!reportName} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-display">{reportName}</DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Showing data for {branch === "all" ? "all branches" : branch}
              </DialogDescription>
            </div>
            <div className="flex gap-4 items-center">
              {/* Duplicated Range Filter for Modal */}
              <div className="hidden sm:flex flex-wrap items-center gap-2">
                <div className="flex rounded-full border border-border bg-card p-1 text-[11px] font-medium scale-90 origin-right">
                  {["today", "yesterday", "thisMonth"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={`rounded-full px-3 py-1 transition-colors ${
                        range === r ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r === "today" ? "Today" : r === "yesterday" ? "Yesterday" : "This Month"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium h-[28px] scale-90 origin-right">
                  <button onClick={() => setRange(`month:${format(subMonths(range.startsWith("month:") ? new Date(range.split(":")[1] + "-01T00:00:00") : new Date(), 1), "yyyy-MM")}`)} className="p-0.5 hover:bg-muted rounded-full">
                    <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <span className="px-2 min-w-[80px] text-center font-semibold">
                    {range.startsWith("month:") ? format(new Date(range.split(":")[1] + "-01T00:00:00"), "MMM yyyy") : format(new Date(), "MMM yyyy")}
                  </span>
                  <button onClick={() => setRange(`month:${format(addMonths(range.startsWith("month:") ? new Date(range.split(":")[1] + "-01T00:00:00") : new Date(), 1), "yyyy-MM")}`)} className="p-0.5 hover:bg-muted rounded-full">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => onExport("PDF", reportName)} className="text-[11px] px-3 py-1.5 rounded-full bg-foreground text-background font-semibold shadow-sm hover:opacity-90">PDF</button>
                <button onClick={() => onExport("Excel", reportName)} className="text-[11px] px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-accent font-semibold hover:text-foreground">Excel</button>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/40 z-10 backdrop-blur-md">
              <TableRow>
                {headers.map((h, i) => (
                  <TableHead key={i} className="whitespace-nowrap font-semibold h-10 px-4">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="text-center h-32 text-muted-foreground">
                    No data available for this report.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j} className="whitespace-nowrap px-4 py-2.5">
                        {j === headers.length - 1 && typeof cell === "string" && (cell === "Present" || cell === "Approved") ? (
                          <span className="text-success bg-success/10 px-2 py-0.5 rounded text-[11px] font-semibold">{cell}</span>
                        ) : j === headers.length - 1 && typeof cell === "string" && (cell === "Absent" || cell === "Rejected") ? (
                          <span className="text-destructive bg-destructive/10 px-2 py-0.5 rounded text-[11px] font-semibold">{cell}</span>
                        ) : j === headers.length - 1 && typeof cell === "string" && (cell === "Late" || cell === "Pending") ? (
                          <span className="text-warning bg-warning/10 px-2 py-0.5 rounded text-[11px] font-semibold">{cell}</span>
                        ) : (
                          cell
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
