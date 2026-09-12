import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";
import {
  Banknote,
  Plus,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Paperclip,
  ChevronRight,
  CalendarCheck,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import {
  createAdvanceRequest,
  listMyAdvances,
  cancelMyAdvance,
  getAdvanceEligibility,
  type EmployeeAdvance,
} from "@/backend/functions/advances.functions";

export const Route = createFileRoute("/employee/advances")({
  component: EmployeeAdvancesPage,
});

const STATUS_T_KEY: Record<string, any> = {
  draft: "advancesDraft",
  pending_manager: "advancesPendingManager",
  pending_hr: "advancesPendingHR",
  pending_finance: "advancesPendingFinance",
  approved_for_payment: "advancesApproved",
  paid: "advancesPaid",
  rejected: "advancesRejected",
  cancelled: "advancesCancelled",
  returned: "advancesReturned",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending_manager: <Clock className="h-4 w-4 text-amber-500" />,
  pending_hr: <Clock className="h-4 w-4 text-blue-500" />,
  pending_finance: <Clock className="h-4 w-4 text-purple-500" />,
  approved_for_payment: <CheckCircle2 className="h-4 w-4 text-teal-500" />,
  paid: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  rejected: <XCircle className="h-4 w-4 text-red-500" />,
  cancelled: <XCircle className="h-4 w-4 text-slate-400" />,
  returned: <XCircle className="h-4 w-4 text-orange-500" />,
};

const STEP_ORDER = [
  "pending_manager",
  "pending_hr",
  "pending_finance",
  "approved_for_payment",
  "paid",
];

function getStepIndex(status: string) {
  return STEP_ORDER.indexOf(status);
}

function fmt(n: number | null | undefined, currency = "EGP") {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 }) + " " + currency;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function EmployeeAdvancesPage() {
  const { t, tf } = useI18n();
  const session = useSession();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyAdvances);
  const createFn = useServerFn(createAdvanceRequest);
  const cancelFn = useServerFn(cancelMyAdvance);
  const eligibilityFn = useServerFn(getAdvanceEligibility);

  const [showForm, setShowForm] = useState(false);
  const [selectedAdv, setSelectedAdv] = useState<EmployeeAdvance | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [currency] = useState("EGP");

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ["employee", "advances"],
    queryFn: () => listFn(),
  });

  const { data: eligibilityData, isLoading: isLoadingEligibility } = useQuery({
    queryKey: ["employee", "advance-eligibility"],
    queryFn: () => eligibilityFn(),
  });

  const hasPending = advances.some((a) =>
    ["pending_manager", "pending_hr", "pending_finance"].includes(a.status),
  );

  // Eligibility helpers
  const isInWindow = eligibilityData?.isInWindow ?? false;
  const windowStart = eligibilityData?.windowStart ? new Date(eligibilityData.windowStart) : null;
  const windowEnd = eligibilityData?.windowEnd ? new Date(eligibilityData.windowEnd) : null;
  const nextWindowStart = eligibilityData?.nextWindowStart ? new Date(eligibilityData.nextWindowStart) : null;

  const eligibility = {
    isProbation: eligibilityData?.isProbation ?? false,
    remainingAnnualLimit: eligibilityData?.remainingAnnualLimit ?? 0,
    hasActiveAdvance: eligibilityData?.hasActiveAdvance ?? false,
    hasPendingRequest: eligibilityData?.hasPendingRequest ?? hasPending,
    outstandingBalance: eligibilityData?.outstandingBalance ?? 0,
  };

  // Build a specific, prioritized reason
  let cannotRequestReason: { title: string; detail: string } | null = null;
  if (!isInWindow) {
    const nextDate = nextWindowStart ? fmtDate(nextWindowStart.toISOString()) : "15";
    cannotRequestReason = {
      title: t("advancesOutsideWindow"),
      detail: tf("advancesOutsideWindowDesc", { date: nextDate }),
    };
  } else if (eligibility.isProbation) {
    cannotRequestReason = {
      title: t("advancesProbationTitle"),
      detail: t("advancesProbationDetail"),
    };
  } else if (eligibility.hasActiveAdvance) {
    cannotRequestReason = {
      title: t("advancesOutstandingTitle"),
      detail: tf("advancesOutstandingDetail", { amount: fmt(eligibility.outstandingBalance) }),
    };
  } else if (eligibility.hasPendingRequest) {
    cannotRequestReason = {
      title: t("advancesPendingTitle"),
      detail: t("advancesPendingDetail"),
    };
  } else if (eligibility.remainingAnnualLimit <= 0) {
    cannotRequestReason = {
      title: t("advancesAnnualLimitTitle"),
      detail: t("advancesAnnualLimitDetail"),
    };
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          requested_amount: Number(amount),
          reason,
          expected_date: expectedDate || null,
          currency,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Request ${res.request_number} submitted successfully!`);
      setShowForm(false);
      setAmount("");
      setReason("");
      setExpectedDate("");
      qc.invalidateQueries({ queryKey: ["employee", "advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Request cancelled");
      setSelectedAdv(null);
      qc.invalidateQueries({ queryKey: ["employee", "advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold flex items-center gap-2">
            <Banknote className="h-5 w-5 text-brand" />
            {t("advancesMyTitle")}
          </h1>
          <p className="text-xs text-muted-foreground">{t("advancesMySubtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!!cannotRequestReason}
          title={cannotRequestReason?.detail || t("advancesNewReqBtn")}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus className="h-4 w-4" /> {t("advancesNewReqBtn")}
        </button>
      </div>

      {/* Eligibility window banner */}
      {!isLoadingEligibility && (
        <div
          className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs ${
            isInWindow
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {isInWindow ? (
            <CalendarCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <CalendarClock className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
          )}
          <div className="space-y-0.5">
            <p className="font-semibold">
              {isInWindow
                ? tf("advancesWindowOpen", { date: windowEnd ? fmtDate(windowEnd.toISOString()) : "" })
                : t("advancesWindowClosed")}
            </p>
            <p className="opacity-90">
              {isInWindow
                ? t("advancesWindowOpenDesc")
                : tf("advancesNextWindow", {
                    start: windowStart ? fmtDate(windowStart.toISOString()) : "",
                    end: windowEnd ? fmtDate(windowEnd.toISOString()) : "",
                  })}
            </p>
          </div>
        </div>
      )}

      {cannotRequestReason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-0.5">
            <p className="font-semibold">{cannotRequestReason.title}</p>
            <p className="opacity-90">{cannotRequestReason.detail}</p>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : advances.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Banknote className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">{t("advancesNoRequestsYet")}</p>
          <button
            onClick={() => setShowForm(true)}
            disabled={!!cannotRequestReason}
            title={cannotRequestReason?.detail || t("advancesSubmitFirst")}
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand"
          >
            <Plus className="h-4 w-4" /> {t("advancesSubmitFirst")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {advances.map((adv) => (
            <button
              key={adv.id}
              onClick={() => setSelectedAdv(adv)}
              className="w-full rounded-2xl border border-border bg-card p-4 text-start hover:shadow-sm transition-shadow flex items-center gap-4"
            >
              <div className="shrink-0">{STATUS_ICON[adv.status] ?? <Clock className="h-4 w-4 text-muted-foreground" />}</div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold text-brand">{adv.request_number}</p>
                <p className="font-semibold text-sm">{fmt(adv.requested_amount, adv.currency)}</p>
                <p className="text-xs text-muted-foreground truncate">{adv.reason ?? ""}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-muted-foreground">{t(STATUS_T_KEY[adv.status] ?? "advancesDraft")}</p>
                <p className="text-[10px] text-muted-foreground">{fmtDate(adv.created_at)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* New Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">New Advance Request</h3>
              <button onClick={() => setShowForm(false)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 flex justify-between items-center text-xs font-medium text-muted-foreground">
                  <span>{t("advancesRequestedAmount")} (EGP) <span className="text-red-500">*</span></span>
                  <span className="text-brand font-semibold">{t("max")}: {fmt(eligibility.remainingAnnualLimit)}</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  max={eligibility.remainingAnnualLimit}
                  placeholder="e.g. 5000"
                  className="w-full rounded-xl border border-input bg-muted/30 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("advancesReason")} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={t("brieflyExplainAdvance")}
                  className="w-full rounded-xl border border-input bg-muted/30 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("advancesExpectedDate")} ({t("optional")})</label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-muted/30 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                disabled={createMutation.isPending || !amount || !reason.trim()}
                onClick={() => createMutation.mutate()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("advancesSubmitReq")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Detail Modal */}
      {selectedAdv && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setSelectedAdv(null)} />
          <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xs font-semibold text-brand">{selectedAdv.request_number}</p>
                <h3 className="font-display text-lg font-semibold">{fmt(selectedAdv.requested_amount, selectedAdv.currency)}</h3>
              </div>
              <button onClick={() => setSelectedAdv(null)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Status timeline */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("advancesReqStatus")}</p>
              <ol className="space-y-2.5">
                {STEP_ORDER.map((step, i) => {
                  const current = getStepIndex(selectedAdv.status);
                  const done = current > i;
                  const active = current === i;
                  const isTerminal = ["rejected", "cancelled", "returned"].includes(selectedAdv.status);
                  return (
                    <li key={step} className="flex items-center gap-2.5">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                        done ? "bg-emerald-500 text-white"
                          : active && !isTerminal ? "bg-brand text-brand-foreground"
                          : "bg-muted border border-border text-muted-foreground"
                      }`}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={`text-xs ${active && !isTerminal ? "font-semibold text-foreground" : done ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                        {t(STATUS_T_KEY[step] ?? "advancesDraft")}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {["rejected", "cancelled", "returned"].includes(selectedAdv.status) && (
                <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                  <span className="font-semibold capitalize">{selectedAdv.status}</span>
                  {selectedAdv.rejection_reason && `: ${selectedAdv.rejection_reason}`}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-border p-2.5">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("advancesSubmitted")}</p>
                <p>{fmtDate(selectedAdv.created_at)}</p>
              </div>
              {selectedAdv.expected_date && (
                <div className="rounded-xl border border-border p-2.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("advancesExpected")}</p>
                  <p>{fmtDate(selectedAdv.expected_date)}</p>
                </div>
              )}
            </div>

            {selectedAdv.reason && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("advancesReason")}</p>
                <p className="rounded-xl border border-border bg-muted/20 p-3 text-sm">{selectedAdv.reason}</p>
              </div>
            )}

            {/* Cancel button */}
            {["pending_manager", "draft"].includes(selectedAdv.status) && (
              <button
                disabled={cancelMutation.isPending}
                onClick={() => { if (confirm(t("advancesConfirmCancel"))) cancelMutation.mutate(selectedAdv.id); }}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("advancesCancelReq")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
