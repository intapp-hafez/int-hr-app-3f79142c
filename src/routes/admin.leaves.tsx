import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wallet, Pencil, ChevronLeft, ChevronRight, Search, Download, CheckSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { listAllLeavesAdmin, decideLeave } from "@/backend/functions/leaves.functions";
import { listLeaveBalancesAdmin, updateLeaveBalance, bulkUpdateLeaveBalances, exportLeaveBalancesAdmin } from "@/backend/functions/leave-balances.functions";
import { listLeaveTypes } from "@/backend/functions/directory.functions";

const tone: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/admin/leaves")({
  component: AdminLeaves,
});

type Status = "all" | "pending" | "approved" | "rejected" | "cancelled";
const STATUSES: Status[] = ["all", "pending", "approved", "rejected", "cancelled"];

function AdminLeaves() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listAllLeavesAdmin);
  const decideFn = useServerFn(decideLeave);
  const balancesFn = useServerFn(listLeaveBalancesAdmin);
  const updateBalFn = useServerFn(updateLeaveBalance);
  const bulkUpdateBalFn = useServerFn(bulkUpdateLeaveBalances);
  const exportBalFn = useServerFn(exportLeaveBalancesAdmin);
  const [filter, setFilter] = useState<Status>("all");
  const [tab, setTab] = useState<"requests" | "balances">("requests");
  const [balPage, setBalPage] = useState(1);
  const [balPageSize, setBalPageSize] = useState(50);
  const [balTypeFilter, setBalTypeFilter] = useState<string>("all");
  const [balSearch, setBalSearch] = useState("");
  const [balSearchInput, setBalSearchInput] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["admin", "leaves"],
    queryFn: () => listFn(),
  });
  const { data: balData, isLoading: balLoading } = useQuery({
    queryKey: ["admin", "leave-balances", balPage, balPageSize, balTypeFilter, balSearch],
    queryFn: () => balancesFn({ data: { page: balPage, pageSize: balPageSize, leave_type_id: balTypeFilter === "all" ? undefined : balTypeFilter, search: balSearch || undefined } }),
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave_types"],
    queryFn: () => listLeaveTypes(),
    enabled: tab === "balances",
  });

  const pending = leaves.filter((l) => l.status === "pending").length;
  const counts = useMemo(() => {
    const c: Record<Status, number> = { all: leaves.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    leaves.forEach((l) => { c[(l.status as Status)] = (c[(l.status as Status)] ?? 0) + 1; });
    return c;
  }, [leaves]);
  const visible = filter === "all" ? leaves : leaves.filter((l) => l.status === filter);

  const mut = useMutation({
    mutationFn: (vars: { id: string; status: "approved" | "rejected" | "cancelled"; name: string }) =>
      decideFn({ data: { id: vars.id, status: vars.status } }),
    onSuccess: (_d, vars) => {
      const verb = vars.status === "approved" ? "Approved" : vars.status === "rejected" ? "Rejected" : "Cancelled";
      (vars.status === "approved" ? toast.success : toast.warning)(`${verb} ${vars.name}'s leave request`);
      qc.invalidateQueries({ queryKey: ["admin", "leaves"] });
      qc.invalidateQueries({ queryKey: ["admin", "leave-balances"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const balMut = useMutation({
    mutationFn: (v: { id: string; total_days: number }) => updateBalFn({ data: v }),
    onSuccess: () => {
      toast.success("Balance updated");
      qc.invalidateQueries({ queryKey: ["admin", "leave-balances"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const bulkMut = useMutation({
    mutationFn: (v: { ids: string[]; total_days?: number; used_days?: number }) => bulkUpdateBalFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(`Updated ${r?.updated ?? 0} balances`);
      setSelected({});
      qc.invalidateQueries({ queryKey: ["admin", "leave-balances"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const allOnPageSelected = (balData?.rows?.length ?? 0) > 0 && balData!.rows.every((r) => selected[r.id]);

  function toggleAllOnPage() {
    const next = { ...selected };
    if (allOnPageSelected) {
      balData?.rows.forEach((r) => { delete next[r.id]; });
    } else {
      balData?.rows.forEach((r) => { next[r.id] = true; });
    }
    setSelected(next);
  }

  function runBulkEdit() {
    if (selectedIds.length === 0) return;
    const which = window.prompt(`Bulk edit ${selectedIds.length} selected balances.\nType "total" or "used" to choose which field to set:`, "total");
    if (!which) return;
    const field = which.trim().toLowerCase();
    if (field !== "total" && field !== "used") return toast.error('Type "total" or "used"');
    const v = window.prompt(`New ${field === "total" ? "total" : "used"} days (0–365) for ${selectedIds.length} balances`, "0");
    if (v == null) return;
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n < 0 || n > 365) return toast.error("Enter 0–365");
    bulkMut.mutate({ ids: selectedIds, ...(field === "total" ? { total_days: n } : { used_days: n }) });
  }

  async function exportCsv() {
    try {
      setExporting(true);
      const rows = await exportBalFn({ data: { leave_type_id: balTypeFilter === "all" ? undefined : balTypeFilter, search: balSearch || undefined } });
      const header = ["Employee ID", "Employee", "Leave Type", "Year", "Total", "Used", "Remaining"];
      const esc = (s: any) => {
        const str = String(s ?? "");
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };
      const csv = [header.join(","), ...rows.map((r) => [r.employee_id, r.employee_name, r.leave_type_name, r.year, r.total_days, r.used_days, r.remaining].map(esc).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leave-balances-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} rows`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("leaves")}</h1>
          <p className="text-sm text-muted-foreground">{t("leavesSubtitle")}</p>
        </div>
        <span className="rounded-full bg-warning/20 px-3 py-1.5 text-xs font-semibold text-warning-foreground">
          {pending} {t("pendingWord")}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        {(["requests", "balances"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`relative px-4 py-2 text-sm font-medium capitalize transition ${tab === k ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {k === "requests" ? "Requests" : "Balances"}
            {tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "requests" && (
        <>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {s} <span className="ml-1 opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {!isLoading && visible.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "" : filter} leave requests.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((l) => (
          <div key={l.id} className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-brand text-xs font-semibold text-brand-foreground">
                  {l.employee_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <p className="font-semibold">{l.employee_name}</p>
                  <p className="text-[11px] text-muted-foreground">{l.leave_type_name ?? "Leave"}{l.days ? ` · ${l.days}d` : ""}{l.paid === false ? " · unpaid" : ""}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone[l.status] ?? "bg-muted text-muted-foreground"}`}>
                {l.status}
              </span>
            </div>
            <div className="mt-4 rounded-xl bg-muted/60 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("fromWord")}</span><span className="font-medium">{l.start_date}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">{t("toWord")}</span><span className="font-medium">{l.end_date}</span></div>
              {l.reason && <p className="mt-2 text-[11px] italic text-muted-foreground">"{l.reason}"</p>}
            </div>
            {(l as any).proof_url && (
              <a
                href={(l as any).proof_url}
                target="_blank"
                rel="noopener noreferrer"
                download={(l as any).proof_name ?? undefined}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
              >
                📎 {(l as any).proof_name ?? "View proof"}
              </a>
            )}
            {l.status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <button disabled={mut.isPending} onClick={() => mut.mutate({ id: l.id, status: "approved", name: l.employee_name })} className="flex-1 rounded-xl bg-success px-3 py-2 text-xs font-semibold text-success-foreground disabled:opacity-50">{t("approve")}</button>
                <button disabled={mut.isPending} onClick={() => mut.mutate({ id: l.id, status: "rejected", name: l.employee_name })} className="flex-1 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50">{t("reject")}</button>
                <button disabled={mut.isPending} onClick={() => mut.mutate({ id: l.id, status: "cancelled", name: l.employee_name })} className="flex-1 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50">Cancel</button>
              </div>
            ) : l.status === "approved" ? (
              <div className="mt-3">
                <button disabled={mut.isPending} onClick={() => mut.mutate({ id: l.id, status: "cancelled", name: l.employee_name })} className="w-full rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50">Cancel approval</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
        </>
      )}

      {tab === "balances" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" /> Annual allowance per employee · auto-seeded on hire and on new leave types.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <form
              onSubmit={(e) => { e.preventDefault(); setBalSearch(balSearchInput.trim()); setBalPage(1); }}
              className="relative flex items-center"
            >
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={balSearchInput}
                onChange={(e) => setBalSearchInput(e.target.value)}
                placeholder="Search employee name or ID…"
                className="w-64 rounded-xl border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            </form>
            <select
              value={balTypeFilter}
              onChange={(e) => { setBalTypeFilter(e.target.value); setBalPage(1); }}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All leave types</option>
              {leaveTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={balPageSize}
              onChange={(e) => { setBalPageSize(Number(e.target.value)); setBalPage(1); }}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={runBulkEdit}
                disabled={selectedIds.length === 0 || bulkMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                <CheckSquare className="h-3.5 w-3.5" /> Bulk edit{selectedIds.length ? ` (${selectedIds.length})` : ""}
              </button>
              <button
                onClick={exportCsv}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" /> {exporting ? "Exporting…" : "Export CSV"}
              </button>
            </div>
          </div>

          {balLoading && (
            <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!balLoading && (balData?.rows?.length ?? 0) === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No balances yet. Add employees and active leave types.
            </div>
          )}
          {(balData?.rows?.length ?? 0) > 0 && (
            <>
            <div className="overflow-hidden rounded-3xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label="Select all on page" />
                    </th>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Leave Type</th>
                    <th className="px-4 py-3 text-right">Year</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Used</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {balData!.rows.map((b: any) => (
                    <tr key={b.id} className="border-t border-border/60">
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={!!selected[b.id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [b.id]: e.target.checked }))}
                          aria-label={`Select ${b.employee_name}`}
                        />
                      </td>
                      <td className="px-4 py-2.5 font-medium">{b.employee_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{b.leave_type_name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{b.year}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{b.total_days}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{b.used_days}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${b.remaining === 0 ? "text-destructive" : "text-success"}`}>{b.remaining}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => {
                            const v = window.prompt(`Total days for ${b.employee_name} · ${b.leave_type_name}`, String(b.total_days));
                            if (v == null) return;
                            const n = parseInt(v, 10);
                            if (Number.isNaN(n) || n < 0 || n > 365) return toast.error("Enter 0–365");
                            balMut.mutate({ id: b.id, total_days: n });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
                        ><Pencil className="h-3 w-3" /> Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {(balData!.page - 1) * balData!.pageSize + 1}–{Math.min(balData!.page * balData!.pageSize, balData!.total)} of {balData!.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={balData!.page <= 1}
                  onClick={() => setBalPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="rounded-xl bg-muted px-3 py-2 text-xs font-medium tabular-nums">{balData!.page}</span>
                <button
                  disabled={balData!.page * balData!.pageSize >= balData!.total}
                  onClick={() => setBalPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-40 hover:bg-muted"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
