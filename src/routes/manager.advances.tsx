import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  X,
  Eye,
  Users,
  User,
} from "lucide-react";
import { EmployeeAdvancesPage } from "@/components/employee/EmployeeAdvancesPage";
import {
  listTeamAdvances,
  managerDecideAdvance,
  type EmployeeAdvance,
} from "@/backend/functions/advances.functions";
import type { AdvanceStatus } from "@/backend/schemas";

export const Route = createFileRoute("/manager/advances")({
  component: ManagerAdvancesPage,
});



const STATUS_T_KEY: Record<AdvanceStatus, any> = {
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

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending_manager: "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
  pending_hr: "bg-blue-100 text-blue-700",
  pending_finance: "bg-purple-100 text-purple-700",
  approved_for_payment: "bg-teal-100 text-teal-700",
  paid: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
  returned: "bg-orange-100 text-orange-700",
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function fmt(n: number | null | undefined, currency = "EGP") {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 }) + " " + currency;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ManagerAdvancesPage() {
  const { t, isAr } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamAdvances);
  const decideFn = useServerFn(managerDecideAdvance);

  const [mainTab, setMainTab] = useState<"team" | "personal">("team");
  const [statusFilter, setStatusFilter] = useState("all");
  const [decideModal, setDecideModal] = useState<EmployeeAdvance | null>(null);
  const [decideAction, setDecideAction] = useState<"approved" | "rejected" | "returned">("approved");
  const [decideComments, setDecideComments] = useState("");
  const [detailAdv, setDetailAdv] = useState<EmployeeAdvance | null>(null);

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ["manager", "advances"],
    queryFn: () => listFn(),
  });

  const pendingCount = advances.filter((a) => a.status === "pending_manager").length;

  const visible = statusFilter === "all" ? advances : advances.filter((a) => a.status === statusFilter);

  const decideMutation = useMutation({
    mutationFn: (v: { id: string; action: "approved" | "rejected" | "returned"; comments?: string }) =>
      decideFn({ data: { id: v.id, action: v.action, comments: v.comments } }),
    onSuccess: () => {
      toast.success("Decision recorded");
      setDecideModal(null);
      setDecideComments("");
      qc.invalidateQueries({ queryKey: ["manager", "advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Title with Tab Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <Banknote className="h-4 w-4" />
            <span>{isAr ? "السلف والعهد المالية" : "Advances & Loans"}</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {mainTab === "team"
              ? isAr ? "سلف الفريق" : "Team Advances"
              : isAr ? "سلفي وقروضي الخاصة" : "My Advances & Loans"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mainTab === "team"
              ? isAr
                ? "مراجعة واعتماد أو رفض طلبات السلف المقدمة من أعضاء فريقك."
                : "Review and approve advance requests submitted by your team members."
              : isAr
                ? "تقديم طلب سلفة أو قرض شخصي ومتابعة الحدود والموافقات."
                : "Request an advance or loan for yourself and track approval progress."}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex items-center rounded-2xl bg-muted/60 p-1 border border-border/50 text-xs font-medium self-start sm:self-auto shadow-xs">
          <button
            type="button"
            onClick={() => setMainTab("team")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all ${
              mainTab === "team"
                ? "bg-card font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{isAr ? "سلف الفريق" : "Team Advances"}</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMainTab("personal")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all ${
              mainTab === "personal"
                ? "bg-card font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4" />
            <span>{isAr ? "سلفي الخاصة" : "My Advances"}</span>
          </button>
        </div>
      </div>

      {mainTab === "personal" ? (
        <EmployeeAdvancesPage hideHeader={true} />
      ) : (
        <>
          {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "All" },
          { value: "pending_manager", label: "Needs Review" },
          { value: "pending_hr", label: "Pending HR" },
          { value: "paid", label: "Paid" },
          { value: "rejected", label: "Rejected" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
            {f.value === "pending_manager" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Banknote className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No advance requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((adv) => (
            <div
              key={adv.id}
              className={`rounded-2xl border bg-card p-4 transition-shadow hover:shadow-sm ${
                adv.status === "pending_manager" ? "border-amber-200 ring-1 ring-amber-100" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-xs font-semibold text-brand">{adv.request_number}</p>
                    <StatusBadge status={adv.status} label={t(STATUS_T_KEY[adv.status as AdvanceStatus] ?? "advancesDraft")} />
                  </div>
                  <p className="mt-1 font-semibold">{adv.employee?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{adv.employee?.department?.name_en ?? ""} · {adv.employee?.position?.name_en ?? ""}</p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{adv.reason ?? ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-foreground">{fmt(adv.requested_amount, adv.currency)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(adv.created_at)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setDetailAdv(adv)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" /> Details
                </button>
                {adv.status === "pending_manager" && (
                  <>
                    <button
                      onClick={() => { setDecideModal(adv); setDecideAction("approved"); setDecideComments(""); }}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors ring-1 ring-emerald-200"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => { setDecideModal(adv); setDecideAction("returned"); setDecideComments(""); }}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Return
                    </button>
                    <button
                      onClick={() => { setDecideModal(adv); setDecideAction("rejected"); setDecideComments(""); }}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailAdv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setDetailAdv(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-sm font-semibold text-brand">{detailAdv.request_number}</p>
                <h3 className="font-display text-lg font-semibold">{detailAdv.employee?.full_name ?? "Employee"}</h3>
              </div>
              <button onClick={() => setDetailAdv(null)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Amount</p>
                <p className="font-bold">{fmt(detailAdv.requested_amount, detailAdv.currency)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Date</p>
                <p className="font-medium">{fmtDate(detailAdv.created_at)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Department</p>
                <p>{detailAdv.employee?.department?.name_en ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Expected Date</p>
                <p>{fmtDate(detailAdv.expected_date)}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("advancesReason")}</p>
              <p className="rounded-xl border border-border bg-muted/20 p-3 text-sm">{detailAdv.reason ?? "—"}</p>
            </div>
            <StatusBadge status={detailAdv.status} label={t(STATUS_T_KEY[detailAdv.status as AdvanceStatus] ?? "advancesDraft")} />
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {decideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setDecideModal(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-semibold">Manager Review</h3>
              <button onClick={() => setDecideModal(null)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              {decideModal.employee?.full_name} · {fmt(decideModal.requested_amount, decideModal.currency)}
            </p>

            <div className="flex gap-2">
              {(["approved", "returned", "rejected"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setDecideAction(a)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium capitalize transition-all ${
                    decideAction === a
                      ? a === "approved" ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : a === "returned" ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-red-500 bg-red-50 text-red-700"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Comments {decideAction !== "approved" && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={decideComments}
                onChange={(e) => setDecideComments(e.target.value)}
                rows={3}
                placeholder="Add comments…"
                className="w-full rounded-xl border border-input bg-muted/30 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setDecideModal(null)} className="flex-1 rounded-xl border border-border py-2 text-sm font-medium hover:bg-muted">
                Cancel
              </button>
              <button
                disabled={decideMutation.isPending || (decideAction !== "approved" && !decideComments.trim())}
                onClick={() => decideMutation.mutate({ id: decideModal.id, action: decideAction, comments: decideComments || undefined })}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                  decideAction === "approved" ? "bg-emerald-600 hover:bg-emerald-700"
                    : decideAction === "returned" ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {decideMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
