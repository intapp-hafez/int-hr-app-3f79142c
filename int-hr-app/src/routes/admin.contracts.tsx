import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileSignature, Search, ChevronRight, CalendarClock, AlertTriangle,
  CheckCircle2, RotateCcw, Ban, LayoutGrid, TableIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import {
  listContractsAdmin,
  renewContractAdmin,
  cancelContractAdmin,
  reactivateContractAdmin,
  type ContractRow as ApiContractRow,
} from "@/backend/functions/contracts.functions";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/contracts")({
  component: ContractsPage,
});

type FilterKey = "all" | "15" | "30" | "45" | "60" | "90" | "expired" | "cancelled";

type Row = {
  id: string;
  empCode: string | null;
  name: string;
  position: string;
  dept: string;
  start: Date | null;
  end: Date | null;
  remaining: number | null;
  cancelled: boolean;
};

const DAY = 86_400_000;
function daysUntil(end: Date) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(end); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY);
}
function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}
function rowsFromApi(api: ApiContractRow[]): Row[] {
  return api.map((r) => {
    const start = r.contract_start_date ? new Date(r.contract_start_date) : null;
    const end = r.contract_end_date ? new Date(r.contract_end_date) : null;
    return {
      id: r.id,
      empCode: r.emp_code ?? null,
      name: r.full_name || r.emp_code || r.id,
      position: r.position || r.contract_type || "—",
      dept: r.department || "—",
      start,
      end,
      remaining: end ? daysUntil(end) : null,
      cancelled: r.contract_cancelled,
    };
  });
}

function ContractsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [qDebounced, filter, pageSize]);

  const listFn = useServerFn(listContractsAdmin);
  const queryKey = ["admin", "contracts", "list", { q: qDebounced, filter, page, pageSize }] as const;
  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { q: qDebounced, filter, page, pageSize } }),
    placeholderData: (prev) => prev,
  });
  const rows = useMemo(() => rowsFromApi(data?.rows ?? []), [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const counts = data?.counts ?? { total: 0, expiring30: 0, expiring90: 0, expired: 0 };

  const renewFn = useServerFn(renewContractAdmin);
  const cancelFn = useServerFn(cancelContractAdmin);
  const reactivateFn = useServerFn(reactivateContractAdmin);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "contracts"] });
  const renewMut = useMutation({
    mutationFn: (vars: { id: string; months: number }) => renewFn({ data: vars }),
    onSuccess: (res) => {
      toast.success(t("contractRenewed"), { description: res?.contract_end_date ? `${t("contractEnd")}: ${res.contract_end_date}` : undefined });
      invalidate();
    },
    onError: (e: any) => toast.error(t("contractRenewed"), { description: e?.message ?? "Failed" }),
  });
  const cancelMut = useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      cancelFn({ data: { id: vars.id, reason: vars.reason } }),
    onSuccess: (res: any) => {
      const reason = res?.reason as string | null | undefined;
      toast.success(t("cancelContract"), {
        description: reason
          ? `${t("contractCancelledMsg")} — ${t("reason")}: ${reason}`
          : t("contractCancelledMsg"),
      });
      invalidate();
    },
    onError: (e: any) => toast.error(t("cancelContract"), { description: e?.message ?? "Failed" }),
  });
  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateFn({ data: { id } }),
    onSuccess: () => { toast.success(t("reactivateContract")); invalidate(); },
    onError: (e: any) => toast.error(t("reactivateContract"), { description: e?.message ?? "Failed" }),
  });
  const mutating = renewMut.isPending || cancelMut.isPending || reactivateMut.isPending;
  const [view, setView] = useState<"table" | "cards">("table");
  useEffect(() => {
    const v = window.localStorage.getItem("int.contractsView");
    if (v === "cards" || v === "table") setView(v);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("int.contractsView", view);
  }, [view]);
  const [dialog, setDialog] = useState<
    | { id: string; name?: string; empCode?: string; endIso?: string; action: "renew12" | "renew6" | "cancel" | "reactivate" }
    | null
  >(null);
  const [cancelReason, setCancelReason] = useState("");
  useEffect(() => {
    if (!dialog || dialog.action !== "cancel") setCancelReason("");
  }, [dialog]);
  const filtered = rows; // server returns already filtered + paginated

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("all") },
    { key: "15", label: t("next15Days") },
    { key: "30", label: t("next30Days") },
    { key: "45", label: t("next45Days") },
    { key: "60", label: t("next60Days") },
    { key: "90", label: t("next90Days") },
    { key: "expired", label: t("expired") },
    { key: "cancelled", label: t("cancelled") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("contracts")}</h1>
          <p className="text-sm text-muted-foreground">{t("contractsSubtitle")}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<FileSignature className="h-4 w-4" />} label={t("totalContracts")} value={counts.total} tone="brand" />
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label={t("expiringIn30")} value={counts.expiring30} tone="warning" />
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label={t("expiringIn90")} value={counts.expiring90} tone="info" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={t("expired")} value={counts.expired} tone="danger" />
      </div>

      {/* Search + filter chips + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-full border border-input bg-card py-2.5 ps-9 pe-3 text-sm"
            placeholder={t("search")}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "border border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ms-auto flex rounded-full border border-border bg-card p-0.5">
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "table" ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"
            }`}
            title={t("tableView")}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("tableView")}</span>
          </button>
          <button
            onClick={() => setView("cards")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "cards" ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"
            }`}
            title={t("cardView")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("cardView")}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "table" ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">{t("name")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("contractStart")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("contractEnd")}</TableHead>
                <TableHead className="w-[120px]">{t("remainingDays")}</TableHead>
                <TableHead className="w-[100px]">{t("status")}</TableHead>
                <TableHead className="w-[220px]">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const tone = r.cancelled ? remainingTone(-999) : remainingTone(r.remaining ?? 99999);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar id={r.id} name={r.name} className="h-8 w-8 shrink-0" />
                        <div>
                          <p className="font-semibold text-sm">{r.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{r.empCode || r.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.position}</TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs">{fmtDate(r.start)}</TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs">{fmtDate(r.end)}</TableCell>
                    <TableCell>
                      <span className={`text-sm font-semibold ${tone.text}`}>
                        {r.cancelled
                          ? `—`
                          : r.remaining === null
                            ? `—`
                            : r.remaining < 0
                            ? `${Math.abs(r.remaining)} ${t("daysAgo")}`
                            : `${r.remaining} ${t("days")}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone.pill}`}>
                        {tone.label(t)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!r.cancelled && (
                          <>
                            <ActionBtn onClick={() => setDialog({ id: r.id, name: r.name, empCode: r.empCode || r.id, endIso: fmtDate(r.end), action: "renew12" })}>
                              <RotateCcw className="h-3 w-3" /> <span className="hidden xl:inline">{t("renewOneYear")}</span>
                            </ActionBtn>
                            <ActionBtn onClick={() => setDialog({ id: r.id, name: r.name, empCode: r.empCode || r.id, endIso: fmtDate(r.end), action: "renew6" })}>
                              <RotateCcw className="h-3 w-3" /> <span className="hidden xl:inline">{t("renewSixMonths")}</span>
                            </ActionBtn>
                            <ActionBtn danger onClick={() => setDialog({ id: r.id, name: r.name, empCode: r.empCode || r.id, endIso: fmtDate(r.end), action: "cancel" })}>
                              <Ban className="h-3 w-3" /> <span className="hidden xl:inline">{t("cancelContract")}</span>
                            </ActionBtn>
                          </>
                        )}
                        {r.cancelled && (
                          <ActionBtn onClick={() => setDialog({ id: r.id, name: r.name, empCode: r.empCode || r.id, endIso: fmtDate(r.end), action: "reactivate" })}>
                            <RotateCcw className="h-3 w-3" /> <span className="hidden xl:inline">{t("reactivateContract")}</span>
                          </ActionBtn>
                        )}
                        <Link
                          to="/admin/employees/$id"
                          params={{ id: r.id }}
                          className="ms-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          {t("view")} <ChevronRight className="h-3 w-3 rtl-flip" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    —
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const tone = r.cancelled
              ? {
                  pill: "bg-muted text-muted-foreground",
                  text: "text-muted-foreground",
                  icon: "text-muted-foreground",
                  label: (t2: any) => t2("cancelled"),
                }
              : remainingTone(r.remaining ?? 99999);
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar id={r.id} name={r.name} fallbackClassName="text-xs" />
                    <div>
                      <p className="font-semibold leading-tight">{r.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{r.empCode || r.id}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone.pill}`}>
                    {tone.label(t)}
                  </span>
                </div>

                <p className="mb-3 text-sm text-muted-foreground">
                  {r.position} · {r.dept}
                </p>

                <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">{t("contractStart")}</p>
                    <p className="mt-0.5 font-mono font-medium">{fmtDate(r.start)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("contractEnd")}</p>
                    <p className="mt-0.5 font-mono font-medium">{fmtDate(r.end)}</p>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 border-t border-border pt-2">
                    {r.remaining !== null && r.remaining < 0 ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle2 className={`h-3.5 w-3.5 ${tone.icon}`} />}
                    <span className="text-muted-foreground">{t("remainingDays")}:</span>
                    <span className={`font-semibold ${tone.text}`}>
                      {r.remaining === null ? `—` : r.remaining < 0 ? `${Math.abs(r.remaining)} ${t("daysAgo")}` : `${r.remaining} ${t("days")}`}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!r.cancelled && (
                    <>
                      <button
                        onClick={() => setDialog({ id: r.id, name: r.name, empCode: r.empCode || r.id, endIso: fmtDate(r.end), action: "renew12" })}
                        className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-[10px] font-semibold text-brand-foreground shadow-brand"
                      >
                        <RotateCcw className="h-3 w-3" /> {t("renewOneYear")}
                      </button>
                      <button
                        onClick={() => setDialog({ id: r.id, name: r.name, empCode: r.empCode || r.id, endIso: fmtDate(r.end), action: "renew6" })}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold"
                      >
                        <RotateCcw className="h-3 w-3" /> {t("renewSixMonths")}
                      </button>
                      <button
                        onClick={() => setDialog({ id: r.id, name: r.name, empCode: r.empCode || r.id, endIso: fmtDate(r.end), action: "cancel" })}
                        className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/15"
                      >
                        <Ban className="h-3 w-3" /> {t("cancelContract")}
                      </button>
                    </>
                  )}
                  {r.cancelled && (
                    <button
                      onClick={() => setDialog({ id: r.id, name: r.name, empCode: r.empCode || r.id, endIso: fmtDate(r.end), action: "reactivate" })}
                      className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-[10px] font-semibold text-brand-foreground shadow-brand"
                    >
                      <RotateCcw className="h-3 w-3" /> {t("reactivateContract")}
                    </button>
                  )}
                  <Link
                    to="/admin/employees/$id"
                    params={{ id: r.id }}
                    className="ms-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    {t("view")} <ChevronRight className="h-3 w-3 rtl-flip" />
                  </Link>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              —
            </div>
          )}
        </div>
      )}

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          {isFetching ? "Loading…" : null}
          {!isFetching && total > 0 ? (
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
            </span>
          ) : null}
          {!isFetching && total === 0 ? <span>—</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <span>Per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-input bg-card px-2 py-1 text-xs"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-border bg-card px-2.5 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-1 font-medium text-foreground">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-border bg-card px-2.5 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <AlertDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog?.action === "cancel"
                ? t("cancelContract")
                : dialog?.action === "reactivate"
                  ? t("reactivateContract")
                  : dialog?.action === "renew12"
                    ? t("renewOneYear")
                    : dialog?.action === "renew6"
                      ? t("renewSixMonths")
                      : t("renew")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.name ? <span className="block font-semibold text-foreground">{dialog.name}</span> : null}
              {dialog?.empCode ? (
                <span className="block text-xs font-mono text-muted-foreground">{dialog.empCode}</span>
              ) : null}
              {dialog?.endIso && dialog.endIso !== "—" ? (
                <span className="block text-xs text-muted-foreground">{t("contractEnd")}: {dialog.endIso}</span>
              ) : null}
              <span className="mt-2 block">
                {dialog?.action === "cancel"
                  ? t("confirmCancelContract")
                  : dialog?.action === "reactivate"
                    ? t("confirmReactivateContract")
                    : t("confirmRenewContract")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialog?.action === "cancel" ? (
            <div className="px-1 pb-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("reason")}
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t("cancelReasonPlaceholder")}
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDialog(null)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutating}
              onClick={() => {
                if (!dialog) return;
                if (dialog.action === "renew12") renewMut.mutate({ id: dialog.id, months: 12 });
                else if (dialog.action === "renew6") renewMut.mutate({ id: dialog.id, months: 6 });
                else if (dialog.action === "cancel") cancelMut.mutate({ id: dialog.id, reason: cancelReason.trim() || undefined });
                else if (dialog.action === "reactivate") reactivateMut.mutate(dialog.id);
                setDialog(null);
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors ${
        danger
          ? "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "border border-border bg-card hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function remainingTone(days: number) {
  if (days < 0) {
    return {
      pill: "bg-destructive/15 text-destructive",
      text: "text-destructive",
      icon: "text-destructive",
      label: (t: any) => t("expired"),
    };
  }
  if (days <= 30) {
    return {
      pill: "bg-destructive/15 text-destructive",
      text: "text-destructive",
      icon: "text-destructive",
      label: (t: any) => t("expiringSoon"),
    };
  }
  if (days <= 90) {
    return {
      pill: "bg-warning/15 text-warning",
      text: "text-warning",
      icon: "text-warning",
      label: (t: any) => t("upcoming"),
    };
  }
  return {
    pill: "bg-success/15 text-success",
    text: "text-success",
    icon: "text-success",
    label: (t: any) => t("active"),
  };
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "brand" | "warning" | "info" | "danger" }) {
  const toneCls = {
    brand: "bg-gradient-brand text-brand-foreground",
    warning: "bg-warning/15 text-warning",
    info: "bg-brand/10 text-brand",
    danger: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className={`grid h-7 w-7 place-items-center rounded-full ${toneCls}`}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}