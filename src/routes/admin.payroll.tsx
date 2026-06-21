import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Wallet, TrendingUp, AlertTriangle, Search, Filter, Award, Lock, Unlock, FileText, Loader2, RefreshCw, ChevronLeft, ChevronRight, FileDown, ArrowUp, ArrowDown, ArrowUpDown, Columns3 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { getPayrollPeriod, lockPayrollRun, unlockPayrollRun, type PayrollRow } from "@/backend/functions/payroll.functions";
import { SubTabs } from "@/components/SubTabs";

export const Route = createFileRoute("/admin/payroll")({
  component: AdminPayroll,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function AdminPayroll() {
  const { t } = useI18n();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  type SortKey = "employee_name" | "salary" | "allowance" | "bonus" | "penalty" | "net_pay" | "kpi" | "daily_rate";
  const [sortKey, setSortKey] = useState<SortKey>("employee_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "employee_name" ? "asc" : "desc"); }
  }

  type ColKey = "salary" | "daily_rate" | "attendance" | "allowance" | "bonus" | "penalty" | "net_pay" | "kpi" | "payslip";
  const COLS: { key: ColKey; label: string }[] = [
    { key: "salary", label: "Salary" },
    { key: "daily_rate", label: "Daily rate" },
    { key: "attendance", label: "P / L / A" },
    { key: "allowance", label: "Allowance" },
    { key: "bonus", label: "Bonus" },
    { key: "penalty", label: "Penalty" },
    { key: "net_pay", label: "Net pay" },
    { key: "kpi", label: "KPI" },
    { key: "payslip", label: "Payslip" },
  ];
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("payroll-visible-cols");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return Object.fromEntries(COLS.map((c) => [c.key, true])) as Record<ColKey, boolean>;
  });
  useEffect(() => {
    try { window.localStorage.setItem("payroll-visible-cols", JSON.stringify(visibleCols)); } catch {}
  }, [visibleCols]);
  const isOn = (k: ColKey) => visibleCols[k] !== false;
  const visibleCount = 1 + COLS.filter((c) => isOn(c.key)).length; // +1 for name col

  const qc = useQueryClient();
  const fetchPeriod = useServerFn(getPayrollPeriod);
  const lockFn = useServerFn(lockPayrollRun);
  const unlockFn = useServerFn(unlockPayrollRun);

  const periodKey = ["payroll-period", year, month] as const;
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: periodKey,
    queryFn: () => fetchPeriod({ data: { year, month } }),
  });

  const lockMut = useMutation({
    mutationFn: () => lockFn({ data: { year, month, workingDays: data?.working_days, latePenaltyRatio: data?.late_penalty_ratio } }),
    onSuccess: () => {
      toast.success(`Payroll for ${MONTHS[month - 1]} ${year} locked`);
      qc.invalidateQueries({ queryKey: periodKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to lock payroll"),
  });
  const unlockMut = useMutation({
    mutationFn: () => unlockFn({ data: { year, month } }),
    onSuccess: () => {
      toast.success(`Payroll for ${MONTHS[month - 1]} ${year} unlocked`);
      qc.invalidateQueries({ queryKey: periodKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to unlock payroll"),
  });

  const rows = data?.rows ?? [];
  const departments = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((r) => r.department).filter((d): d is string => !!d)))],
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (dept !== "All" && r.department !== dept) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.employee_name.toLowerCase().includes(s) ||
      (r.emp_code ?? "").toLowerCase().includes(s) ||
      (r.department ?? "").toLowerCase().includes(s)
    );
  });

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === "string" || typeof bv === "string") {
        return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
      }
      return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(startIdx, startIdx + pageSize);

  useEffect(() => { setPage(1); }, [q, dept, pageSize, year, month, sortKey, sortDir]);

  const totals = filtered.reduce(
    (acc, r) => ({
      base: acc.base + r.salary,
      allowance: acc.allowance + r.allowance,
      bonus: acc.bonus + r.bonus,
      penalty: acc.penalty + r.penalty,
      net: acc.net + r.net_pay,
      kpi: acc.kpi + r.kpi,
    }),
    { base: 0, allowance: 0, bonus: 0, penalty: 0, net: 0, kpi: 0 },
  );
  const avgKpi = filtered.length ? Math.round(totals.kpi / filtered.length) : 0;
  const workingDays = data?.working_days ?? 22;
  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const data = paginated.map((r) => ({
      "Employee Code": r.emp_code ?? "",
      Name: r.employee_name,
      Department: r.department ?? "",
      "Working Days": r.working_days,
      Present: r.present_days,
      Late: r.late_days,
      Absent: r.absent_days,
      Leave: r.leave_days,
      "Daily Rate (EGP)": r.daily_rate,
      "Base Salary (EGP)": r.salary,
      "Allowance (EGP)": r.allowance,
      "Bonus (EGP)": r.bonus,
      "Penalty (EGP)": r.penalty,
      "Net Pay (EGP)": r.net_pay,
      "KPI %": r.kpi,
      "Target Met": r.target_met ? "Yes" : "No",
      "Target (days)": r.target_value ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Object.keys(data[0] ?? {}).map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Payroll ${periodLabel}`);
    // Summary sheet
    const summary = XLSX.utils.aoa_to_sheet([
      [`Payroll Summary — ${periodLabel}`, new Date().toISOString().slice(0, 10)],
      [],
      ["Employees", filtered.length],
      ["Total Base", totals.base],
      ["Total Allowance", totals.allowance],
      ["Total Bonus", totals.bonus],
      ["Total Penalty", totals.penalty],
      ["Total Net Payout", totals.net],
      ["Average KPI %", avgKpi],
    ]);
    XLSX.utils.book_append_sheet(wb, summary, "Summary");
    XLSX.writeFile(wb, `payroll-${year}-${String(month).padStart(2, "0")}.xlsx`);
  }

  function exportCsv() {
    const headers = [
      "Employee Code","Name","Department","Working Days","Present","Late","Absent","Leave",
      "Daily Rate (EGP)","Base Salary (EGP)","Allowance (EGP)","Bonus (EGP)","Penalty (EGP)","Net Pay (EGP)","KPI %","Target Met","Target (days)",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of paginated) {
      lines.push([
        r.emp_code ?? "", r.employee_name, r.department ?? "",
        r.working_days, r.present_days, r.late_days, r.absent_days, r.leave_days,
        r.daily_rate, r.salary, r.allowance, r.bonus, r.penalty, r.net_pay, r.kpi,
        r.target_met ? "Yes" : "No", r.target_value ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${year}-${String(month).padStart(2, "0")}-page${currentPage}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPayslip(r: PayrollRow) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text("Payslip", 40, 50);
    doc.setFontSize(10);
    doc.text(`Period: ${periodLabel}`, 40, 70);
    doc.text(`Issued: ${new Date().toISOString().slice(0, 10)}`, 40, 84);

    autoTable(doc, {
      startY: 110,
      head: [["Employee", "Code", "Department"]],
      body: [[r.employee_name, r.emp_code ?? "—", r.department ?? "—"]],
      theme: "grid",
      styles: { fontSize: 10 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [["Working Days", "Present", "Late", "Absent", "Leave", "KPI", "Target Met"]],
      body: [[
        String(r.working_days), String(r.present_days), String(r.late_days),
        String(r.absent_days), String(r.leave_days), `${r.kpi}%`, r.target_met ? "Yes" : "No",
      ]],
      theme: "grid",
      styles: { fontSize: 10, halign: "center" },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [["Component", "Amount (EGP)"]],
      body: [
        ["Base salary", fmt(r.salary)],
        ["Daily rate", fmt(r.daily_rate)],
        ["Allowance", `+ ${fmt(r.allowance)}`],
        ["Bonus", `+ ${fmt(r.bonus)}`],
        ["Penalty", `- ${fmt(r.penalty)}`],
        [{ content: "Net pay", styles: { fontStyle: "bold" } }, { content: fmt(r.net_pay), styles: { fontStyle: "bold" } }],
      ],
      theme: "grid",
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right" } },
    });

    doc.setFontSize(8);
    doc.text(
      `Formula — Daily rate = Salary ÷ ${r.working_days}. Penalty = (Late × ${data?.late_penalty_ratio ?? 0.25} + Absent × 1) × Daily rate. Bonus = 10% of salary when target met.`,
      40,
      (doc as any).lastAutoTable.finalY + 24,
      { maxWidth: 515 },
    );

    const safeName = r.employee_name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    doc.save(`payslip-${safeName}-${year}-${String(month).padStart(2, "0")}.pdf`);
  }

  return (
    <div className="space-y-5">
      <SubTabs items={[
        { to: "/admin/payroll", label: "Payroll" },
        { to: "/admin/payroll-settings", label: "Payroll Settings" },
      ]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("payroll")}</h1>
          <p className="text-sm text-muted-foreground">
            Real attendance-, leave- and KPI-driven payroll for {periodLabel}. {data?.locked ? "Locked snapshot." : `Live preview · ${workingDays} working days.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </button>
          <button
            onClick={exportXlsx}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
          <button
            onClick={exportCsv}
            disabled={paginated.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm disabled:opacity-50"
            title="Export currently visible (filtered + paginated) rows as CSV"
          >
            <FileDown className="h-4 w-4" /> Export CSV
          </button>
          {data?.locked ? (
            <button
              onClick={() => {
                if (confirm(`Unlock payroll for ${periodLabel}? This deletes the locked snapshot.`)) unlockMut.mutate();
              }}
              disabled={unlockMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-3.5 py-2 text-sm font-semibold text-warning-foreground disabled:opacity-50"
            >
              {unlockMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />} Unlock run
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm(`Lock payroll for ${periodLabel} (${rows.length} employees)? This snapshots all values.`)) lockMut.mutate();
              }}
              disabled={lockMut.isPending || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
            >
              {lockMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Approve & lock
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="inline-flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Period</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
          >
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {data?.locked && data.locked_at && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
            <Lock className="h-3 w-3" /> Locked · {new Date(data.locked_at).toLocaleString()}
          </span>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Wallet} label={t("netPay")} value={`EGP ${fmt(totals.net)}`} tone="brand" />
        <Kpi icon={TrendingUp} label="Base" value={`EGP ${fmt(totals.base)}`} />
        <Kpi icon={Award} label={t("allowance")} value={`EGP ${fmt(totals.allowance)}`} tone="info" />
        <Kpi icon={Award} label={t("bonus")} value={`EGP ${fmt(totals.bonus)}`} tone="success" />
        <Kpi icon={AlertTriangle} label={t("penalty")} value={`EGP ${fmt(totals.penalty)}`} tone="danger" />
        <Kpi icon={TrendingUp} label={`${t("kpi")} avg`} value={`${avgKpi}%`} tone="warning" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-full border border-input bg-card py-2.5 ps-9 pe-3 text-sm"
            placeholder={t("search")}
          />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="bg-transparent outline-none">
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <details className="relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
            <Columns3 className="h-4 w-4 text-muted-foreground" /> Columns
          </summary>
          <div className="absolute end-0 z-20 mt-2 w-52 rounded-2xl border border-border bg-popover p-2 shadow-lg">
            {COLS.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  checked={isOn(c.key)}
                  onChange={(e) => setVisibleCols((v) => ({ ...v, [c.key]: e.target.checked }))}
                />
                {c.label}
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <SortTh sortKey="employee_name" current={sortKey} dir={sortDir} onClick={toggleSort}>{t("name")}</SortTh>
              {isOn("salary") && <SortTh sortKey="salary" current={sortKey} dir={sortDir} onClick={toggleSort} align="end">{t("salary")}</SortTh>}
              {isOn("daily_rate") && <SortTh sortKey="daily_rate" current={sortKey} dir={sortDir} onClick={toggleSort} align="end">{t("dailyRate")}</SortTh>}
              {isOn("attendance") && <Th align="center">P / L / A</Th>}
              {isOn("allowance") && <SortTh sortKey="allowance" current={sortKey} dir={sortDir} onClick={toggleSort} align="end">{t("allowance")}</SortTh>}
              {isOn("bonus") && <SortTh sortKey="bonus" current={sortKey} dir={sortDir} onClick={toggleSort} align="end">{t("bonus")}</SortTh>}
              {isOn("penalty") && <SortTh sortKey="penalty" current={sortKey} dir={sortDir} onClick={toggleSort} align="end">{t("penalty")}</SortTh>}
              {isOn("net_pay") && <SortTh sortKey="net_pay" current={sortKey} dir={sortDir} onClick={toggleSort} align="end">{t("netPay")}</SortTh>}
              {isOn("kpi") && <SortTh sortKey="kpi" current={sortKey} dir={sortDir} onClick={toggleSort} align="center">{t("kpi")}</SortTh>}
              {isOn("payslip") && <Th align="center">Payslip</Th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={visibleCount} className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            )}
            {paginated.map((r) => (
              <tr key={r.employee_id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-brand text-[10px] font-semibold text-brand-foreground">
                      {r.employee_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="font-medium">{r.employee_name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.emp_code ?? "—"}{r.department ? ` · ${r.department}` : ""}</p>
                    </div>
                  </div>
                </td>
                {isOn("salary") && <td className="px-4 py-3 text-end font-mono tabular-nums">{fmt(r.salary)}</td>}
                {isOn("daily_rate") && <td className="px-4 py-3 text-end font-mono tabular-nums text-muted-foreground">{fmt(r.daily_rate)}</td>}
                {isOn("attendance") && (
                  <td className="px-4 py-3 text-center font-mono tabular-nums text-xs">
                    <span className="text-success">{r.present_days}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-warning-foreground">{r.late_days}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-destructive">{r.absent_days}</span>
                  </td>
                )}
                {isOn("allowance") && <td className="px-4 py-3 text-end font-mono tabular-nums text-info">+{fmt(r.allowance)}</td>}
                {isOn("bonus") && <td className="px-4 py-3 text-end font-mono tabular-nums text-success">+{fmt(r.bonus)}</td>}
                {isOn("penalty") && <td className="px-4 py-3 text-end font-mono tabular-nums text-destructive">-{fmt(r.penalty)}</td>}
                {isOn("net_pay") && <td className="px-4 py-3 text-end font-mono tabular-nums font-semibold">{fmt(r.net_pay)}</td>}
                {isOn("kpi") && (
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${r.kpi >= 90 ? "bg-success/15 text-success" : r.kpi >= 75 ? "bg-warning/20 text-warning-foreground" : "bg-destructive/15 text-destructive"}`}>
                      {r.kpi}%
                    </span>
                  </td>
                )}
                {isOn("payslip") && (
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => downloadPayslip(r)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
                    >
                      <FileText className="h-3 w-3" /> PDF
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={visibleCount} className="p-8 text-center text-sm text-muted-foreground">No employees match the current filters for {periodLabel}.</td></tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="border-t border-border bg-muted/40 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={1}>Total ({filtered.length})</td>
                {isOn("salary") && <td className="px-4 py-3 text-end font-mono tabular-nums">{fmt(totals.base)}</td>}
                {isOn("daily_rate") && <td className="px-4 py-3" />}
                {isOn("attendance") && <td className="px-4 py-3" />}
                {isOn("allowance") && <td className="px-4 py-3 text-end font-mono tabular-nums text-info">+{fmt(totals.allowance)}</td>}
                {isOn("bonus") && <td className="px-4 py-3 text-end font-mono tabular-nums text-success">+{fmt(totals.bonus)}</td>}
                {isOn("penalty") && <td className="px-4 py-3 text-end font-mono tabular-nums text-destructive">-{fmt(totals.penalty)}</td>}
                {isOn("net_pay") && <td className="px-4 py-3 text-end font-mono tabular-nums">{fmt(totals.net)}</td>}
                {isOn("kpi") && <td className="px-4 py-3 text-center">{avgKpi}%</td>}
                {isOn("payslip") && <td className="px-4 py-3" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <div className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{startIdx + 1}</span>–<span className="font-medium text-foreground">{Math.min(startIdx + pageSize, filtered.length)}</span> of <span className="font-medium text-foreground">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-muted-foreground">
              Rows
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-sm"
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-muted-foreground">
              Page <span className="font-medium text-foreground">{currentPage}</span> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Formulas — Daily rate = Salary ÷ {workingDays}. Penalty = (Late × {data?.late_penalty_ratio ?? 0.25} + Absent × 1) × Daily rate.
        Bonus = 10% of salary when target met. Net = Salary + Allowance + Bonus − Penalty. Working days exclude Fri/Sat by default.
      </p>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const Th = ({ children, align = "start" }: { children: React.ReactNode; align?: "start" | "end" | "center" }) => {
  const cls = align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start";
  return <th className={`px-4 py-3 font-medium ${cls}`}>{children}</th>;
};

function SortTh<K extends string>({
  children, sortKey, current, dir, onClick, align = "start",
}: {
  children: React.ReactNode;
  sortKey: K;
  current: K;
  dir: "asc" | "desc";
  onClick: (k: K) => void;
  align?: "start" | "end" | "center";
}) {
  const cls = align === "end" ? "text-end justify-end" : align === "center" ? "text-center justify-center" : "text-start justify-start";
  const active = current === sortKey;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-4 py-3 font-medium ${align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start"}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex w-full items-center gap-1 ${cls} ${active ? "text-foreground" : "hover:text-foreground"}`}
      >
        <span>{children}</span>
        <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  );
}

function Kpi({
  icon: Icon, label, value, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "brand" | "success" | "warning" | "danger" | "info";
}) {
  const toneMap: Record<string, string> = {
    default: "bg-card text-foreground",
    brand: "bg-gradient-brand text-brand-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
  };
  return (
    <div className={`rounded-2xl border border-border p-4 ${toneMap[tone]}`}>
      <div className="mb-2 flex items-center gap-2 text-xs opacity-80">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="font-display text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}