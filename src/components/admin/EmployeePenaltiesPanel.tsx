import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  X,
  Pencil,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  Filter,
  Check,
  RotateCcw,
  Gavel,
  BadgeAlert,
  Calendar,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import {
  listEmployeePenalties,
  createEmployeePenalty,
  updateEmployeePenalty,
  deleteEmployeePenalty,
  PENALTY_TYPES,
  type EmployeePenalty,
  type PenaltyStatus,
} from "@/backend/functions/penalties.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);

export function EmployeePenaltiesPanel({
  employeeId,
  canManage = true,
}: {
  employeeId: string;
  canManage?: boolean;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const listFn = useServerFn(listEmployeePenalties);
  const addFn = useServerFn(createEmployeePenalty);
  const updFn = useServerFn(updateEmployeePenalty);
  const delFn = useServerFn(deleteEmployeePenalty);

  const [openModal, setOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeePenalty | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | PenaltyStatus>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Modal form state
  const [formDate, setFormDate] = useState(today());
  const [formType, setFormType] = useState<string>(PENALTY_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formIsPaid, setFormIsPaid] = useState(false);
  const [formAmount, setFormAmount] = useState<string>("0");
  const [formStatus, setFormStatus] = useState<PenaltyStatus>("pending");

  const { data: penalties = [], isLoading } = useQuery({
    queryKey: ["employee-penalties", employeeId],
    queryFn: () => listFn({ data: { employeeId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["employee-penalties", employeeId] });

  const addMut = useMutation({
    mutationFn: (v: any) => addFn({ data: { employeeId, ...v } }),
    onSuccess: () => {
      toast.success(t("penaltySaved") || "Penalty saved successfully");
      setOpenModal(false);
      resetForm();
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save penalty"),
  });

  const updMut = useMutation({
    mutationFn: (v: any) => updFn({ data: v }),
    onSuccess: () => {
      toast.success(t("penaltySaved") || "Penalty updated successfully");
      setOpenModal(false);
      setEditingItem(null);
      resetForm();
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update penalty"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("penaltyDeleted") || "Penalty deleted successfully");
      setDeleteId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete penalty"),
  });

  function resetForm() {
    setFormDate(today());
    setFormType(PENALTY_TYPES[0]);
    setCustomType("");
    setFormReason("");
    setFormIsPaid(false);
    setFormAmount("0");
    setFormStatus("pending");
  }

  function handleOpenAdd() {
    resetForm();
    setEditingItem(null);
    setOpenModal(true);
  }

  function handleOpenEdit(item: EmployeePenalty) {
    setEditingItem(item);
    setFormDate(item.penalty_date);
    if ((PENALTY_TYPES as readonly string[]).includes(item.penalty_type)) {
      setFormType(item.penalty_type);
      setCustomType("");
    } else {
      setFormType("Other");
      setCustomType(item.penalty_type);
    }
    setFormReason(item.reason);
    setFormIsPaid(item.is_paid);
    setFormAmount(String(item.amount || 0));
    setFormStatus(item.status);
    setOpenModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formReason.trim()) {
      toast.error(t("penaltyReason") + " is required");
      return;
    }

    const finalType = formType === "Other" && customType.trim() ? customType.trim() : formType;
    const finalAmount = Number(formAmount) || 0;

    if (editingItem) {
      updMut.mutate({
        id: editingItem.id,
        penaltyDate: formDate,
        penaltyType: finalType,
        reason: formReason.trim(),
        isPaid: formIsPaid,
        amount: finalAmount,
        status: formStatus,
      });
    } else {
      addMut.mutate({
        penaltyDate: formDate,
        penaltyType: finalType,
        reason: formReason.trim(),
        isPaid: formIsPaid,
        amount: finalAmount,
        status: formStatus,
      });
    }
  }

  function handleQuickStatus(id: string, status: PenaltyStatus) {
    updMut.mutate({ id, status });
  }

  // Summary Metrics
  const stats = useMemo(() => {
    let pending = 0;
    let applied = 0;
    let cancelled = 0;
    let totalAmount = 0;
    let paidAmount = 0;

    for (const p of penalties) {
      if (p.status === "pending") pending++;
      else if (p.status === "applied") applied++;
      else if (p.status === "cancelled") cancelled++;

      if (p.status !== "cancelled") {
        totalAmount += p.amount;
        if (p.is_paid) paidAmount += p.amount;
      }
    }

    return {
      total: penalties.length,
      pending,
      applied,
      cancelled,
      totalAmount,
      paidAmount,
    };
  }, [penalties]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = penalties;
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (typeFilter) {
      list = list.filter((p) => p.penalty_type === typeFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.reason.toLowerCase().includes(q) ||
          p.penalty_type.toLowerCase().includes(q) ||
          p.penalty_date.includes(q),
      );
    }
    return list;
  }, [penalties, statusFilter, typeFilter, search]);

  return (
    <div className="space-y-5">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">{t("penalties")}</span>
            <Gavel className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Total recorded</p>
        </div>

        <div className="rounded-2xl border border-amber-200/50 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
            <span className="text-xs font-medium uppercase tracking-wider">{t("statusPending")}</span>
            <Clock className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-200">{stats.pending}</p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">Awaiting resolution</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider">{t("statusApplied")}</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-200">{stats.applied}</p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">Deducted / Applied</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">{t("statusCancelled")}</span>
            <Ban className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-muted-foreground">{stats.cancelled}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Waived / Dismissed</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Fine (EGP)</span>
            <DollarSign className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {stats.totalAmount.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
            Paid: {stats.paidAmount.toLocaleString()} EGP
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reason or details…"
                className="h-9 w-full rounded-xl border border-input bg-background pl-8 pr-3 text-xs"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center rounded-xl border border-border bg-muted/40 p-0.5 text-xs font-medium">
              {(["all", "pending", "applied", "cancelled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-2.5 py-1 capitalize transition-colors ${
                    statusFilter === s
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all" ? t("all") : t((`status${s.charAt(0).toUpperCase() + s.slice(1)}`) as any) || s}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-2.5 text-xs text-muted-foreground"
            >
              <option value="">All Types</option>
              {PENALTY_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>
          </div>

          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95"
            >
              <Plus className="h-4 w-4" /> {t("addPenalty")}
            </button>
          )}
        </div>

        {/* Penalties List Table */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading penalties…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
              <Gavel className="h-6 w-6 opacity-60" />
            </div>
            <p className="text-sm font-medium">{t("noPenalties")}</p>
            <p className="text-xs mt-1">No records match the current criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 font-semibold">{t("penaltyDate")}</th>
                  <th className="py-2.5 px-3 font-semibold">{t("penaltyType")}</th>
                  <th className="py-2.5 px-3 font-semibold min-w-[220px]">{t("penaltyReason")}</th>
                  <th className="py-2.5 px-3 font-semibold text-end">{t("penaltyValue")}</th>
                  <th className="py-2.5 px-3 font-semibold text-center">{t("isPaid")}</th>
                  <th className="py-2.5 px-3 font-semibold">{t("penaltyStatus")}</th>
                  <th className="py-2.5 px-3 font-semibold">Recorded By</th>
                  {canManage && <th className="py-2.5 px-3 font-semibold text-end">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap text-foreground font-medium">
                      {item.penalty_date}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {item.penalty_type}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <p className="text-foreground text-xs leading-relaxed whitespace-pre-line break-words max-w-md">
                        {item.reason}
                      </p>
                    </td>

                    <td className="py-3 px-3 text-end font-mono tabular-nums text-foreground font-semibold">
                      {item.amount > 0 ? (
                        <span>{item.amount.toLocaleString()} EGP</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.is_paid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">
                          <Check className="h-3 w-3" /> Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px]">
                          Unpaid
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-[11px] font-semibold">
                          <Clock className="h-3 w-3" /> {t("statusPending")}
                        </span>
                      )}
                      {item.status === "applied" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> {t("statusApplied")}
                        </span>
                      )}
                      {item.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-medium line-through">
                          <Ban className="h-3 w-3" /> {t("statusCancelled")}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                      {item.creator_name ?? "—"}
                    </td>

                    {canManage && (
                      <td className="py-3 px-3 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* Quick status switchers */}
                          {item.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleQuickStatus(item.id, "applied")}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                                title="Apply penalty"
                              >
                                <Check className="h-3 w-3" /> Apply
                              </button>
                              <button
                                onClick={() => handleQuickStatus(item.id, "cancelled")}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                                title="Cancel penalty"
                              >
                                <Ban className="h-3 w-3" /> Cancel
                              </button>
                            </>
                          )}
                          {item.status === "applied" && (
                            <button
                              onClick={() => handleQuickStatus(item.id, "pending")}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                              title="Revert to pending"
                            >
                              <RotateCcw className="h-3 w-3" /> Revert
                            </button>
                          )}
                          {item.status === "cancelled" && (
                            <button
                              onClick={() => handleQuickStatus(item.id, "pending")}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                              title="Revert to pending"
                            >
                              <RotateCcw className="h-3 w-3" /> Reopen
                            </button>
                          )}

                          {/* Edit button */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                            title={t("editPenalty")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => setDeleteId(item.id)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title={t("deletePenalty")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Gavel className="h-4 w-4" />
                </span>
                <h3 className="font-display text-base font-semibold">
                  {editingItem ? t("editPenalty") : t("addPenalty")}
                </h3>
              </div>
              <button
                onClick={() => setOpenModal(false)}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    {t("penaltyDate")} *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    {t("penaltyType")} *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className={inputCls}
                  >
                    {PENALTY_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom type input if Other is selected */}
              {formType === "Other" && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Specify Penalty Type *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter custom penalty type…"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}

              {/* Reason in details */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  {t("penaltyReason")} *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={
                    t("penaltyReasonPlaceholder") || "Describe the incident or reason for this penalty in detail…"
                  }
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className={`${inputCls} resize-y leading-relaxed`}
                />
              </div>

              {/* Paid Status & Amount / Value */}
              <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsPaid}
                      onChange={(e) => setFormIsPaid(e.target.checked)}
                      className="h-4 w-4 rounded accent-brand"
                    />
                    <span>{t("isPaid")}</span>
                  </label>
                  {formIsPaid && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Paid / Settled
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    {t("penaltyValue")} {formIsPaid ? "*" : "(Optional fine)"}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} font-mono`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      EGP
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formIsPaid
                      ? "Enter the settled penalty value."
                      : "Leave 0 if this is a warning or disciplinary penalty without financial deduction."}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  {t("penaltyStatus")} *
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as PenaltyStatus)}
                  className={inputCls}
                >
                  <option value="pending">{t("statusPending")}</option>
                  <option value="applied">{t("statusApplied")}</option>
                  <option value="cancelled">{t("statusCancelled")}</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Default status is <b>Pending</b> until reviewed or formally applied.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMut.isPending || updMut.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
                >
                  {(addMut.isPending || updMut.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingItem ? "Update Penalty" : "Save Penalty"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deletePenalty")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeletePenalty") || "Are you sure you want to delete this penalty record?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && delMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {delMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
