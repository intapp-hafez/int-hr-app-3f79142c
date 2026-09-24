import { useState, useRef } from "react";
import {
  Plus,
  X,
  Loader2,
  Trash2,
  Paperclip,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n, useTranslators } from "@/lib/i18n";
import { formatDate } from "@/lib/date-format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  submitLeave,
  listMyLeaves,
  cancelLeave,
  listActiveLeaveTypes,
} from "@/backend/functions/leaves.functions";
import {
  listEmployeePermissions,
  requestPermission,
  cancelPermission,
  type MonthlyPermissionQuota,
} from "@/backend/functions/employee-permissions.functions";
import { parseValidationError, fieldError, toastValidationError } from "@/lib/validation-error";

const statusTone: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function LeavesPage() {
  const { t } = useI18n();
  const { tLeaveType, tStatus } = useTranslators();
  const qc = useQueryClient();

  // Tab & Modal States
  const [activeTab, setActiveTab] = useState<"all" | "leaves" | "permissions">("all");
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [permModalOpen, setPermModalOpen] = useState(false);

  // Collapse/Expand States (Show 3 recent by default)
  const [showAllLeaves, setShowAllLeaves] = useState(false);
  const [showAllPermissions, setShowAllPermissions] = useState(false);

  // Server functions
  const listLeavesFn = useServerFn(listMyLeaves);
  const cancelLeaveFn = useServerFn(cancelLeave);
  const listPermsFn = useServerFn(listEmployeePermissions);
  const cancelPermFn = useServerFn(cancelPermission);

  // Leaves query & mutation
  const { data: myLeaves = [], isLoading: isLeavesLoading } = useQuery({
    queryKey: ["my-leaves"],
    queryFn: () => listLeavesFn(),
  });

  const cancelLeaveMut = useMutation({
    mutationFn: (id: string) => cancelLeaveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Leave cancelled");
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
    },
    onError: (e: Error) => {
      toastValidationError(e, "Failed");
    },
  });

  // Permissions query & mutation
  const { data: permsData, isLoading: isPermsLoading } = useQuery({
    queryKey: ["employee", "permissions", "me"],
    queryFn: () => listPermsFn({ data: {} }),
  });

  const permissions = permsData?.permissions ?? [];
  const quota = permsData?.quota;

  const cancelPermMut = useMutation({
    mutationFn: (id: string) => cancelPermFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("permissionCancelled"));
      qc.invalidateQueries({ queryKey: ["employee", "permissions"] });
    },
    onError: (e: Error) => {
      toastValidationError(e, "Failed");
    },
  });

  // 3 recent items logic
  const visibleLeaves = showAllLeaves ? myLeaves : myLeaves.slice(0, 3);
  const hasMoreLeaves = myLeaves.length > 3;

  const visiblePermissions = showAllPermissions ? permissions : permissions.slice(0, 3);
  const hasMorePermissions = permissions.length > 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {activeTab === "leaves"
              ? t("leaves")
              : activeTab === "permissions"
                ? t("employeePermissions")
                : t("leavesAndPermissions")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {activeTab === "leaves"
              ? t("daysRemainingYear")
              : activeTab === "permissions"
                ? t("permissionPolicyNotice")
                : t("leavesAndPermissionsSubtitle")}
          </p>
        </div>
      </header>

      {/* Tabs Filter */}
      <div className="flex items-center gap-1 rounded-2xl bg-muted/50 p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`flex-1 rounded-xl py-1.5 text-center transition ${
            activeTab === "all"
              ? "bg-card font-semibold text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("all")} ({myLeaves.length + permissions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("leaves")}
          className={`flex-1 rounded-xl py-1.5 text-center transition ${
            activeTab === "leaves"
              ? "bg-card font-semibold text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("leaves")} ({myLeaves.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("permissions")}
          className={`flex-1 rounded-xl py-1.5 text-center transition ${
            activeTab === "permissions"
              ? "bg-card font-semibold text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("employeePermissions")} ({permissions.length})
        </button>
      </div>

      {/* ── SECTION 1: LEAVES ── */}
      {(activeTab === "all" || activeTab === "leaves") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{t("leaves")}</span>
            </h2>
            <button
              onClick={() => setLeaveModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
            >
              <Plus className="h-3.5 w-3.5" /> {t("request")}
            </button>
          </div>

          {/* Leaves List */}
          <ul className="space-y-2">
            {isLeavesLoading && (
              <li className="rounded-2xl border border-border bg-card p-6 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </li>
            )}

            {!isLeavesLoading && myLeaves.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                {t("noLeavesYet")}
              </li>
            )}

            {visibleLeaves.map((l: any) => {
              const status = String(l.status ?? "pending");
              const titleStatus = status.charAt(0).toUpperCase() + status.slice(1);
              return (
                <li key={l.id} className="rounded-2xl border border-border bg-card p-4 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{tLeaveType(l.leave_type_name ?? "Other")}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(l.start_date)} → {formatDate(l.end_date)} • {l.days}d
                      </p>
                      {l.reason && (
                        <p className="mt-1 text-[11px] text-muted-foreground">"{l.reason}"</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                          statusTone[status] ?? "bg-muted"
                        }`}
                      >
                        {tStatus(titleStatus)}
                      </span>
                      {status === "pending" && (
                        <button
                          onClick={() => {
                            if (window.confirm("Cancel this leave request?")) {
                              cancelLeaveMut.mutate(l.id);
                            }
                          }}
                          disabled={cancelLeaveMut.isPending}
                          className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                          title="Cancel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Show More / Show Less Leaves */}
          {hasMoreLeaves && (
            <button
              type="button"
              onClick={() => setShowAllLeaves((prev) => !prev)}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/40 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
            >
              {showAllLeaves ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span>{t("showLess")}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span>
                    {t("showMoreLeaves")} ({myLeaves.length - 3})
                  </span>
                </>
              )}
            </button>
          )}
        </section>
      )}

      {/* ── SECTION 2: PERMISSIONS ── */}
      {(activeTab === "all" || activeTab === "permissions") && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>{t("employeePermissions")}</span>
              </h2>
            </div>
            <button
              onClick={() => setPermModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
            >
              <Plus className="h-3.5 w-3.5" /> {t("request")}
            </button>
          </div>

          {/* Permissions List */}
          <ul className="space-y-2">
            {isPermsLoading && (
              <li className="rounded-2xl border border-border bg-card p-6 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </li>
            )}

            {!isPermsLoading && permissions.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                <p>{t("noPermissionsYet")}</p>
                <button
                  type="button"
                  onClick={() => setPermModalOpen(true)}
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  + {t("requestPermission")}
                </button>
              </li>
            )}

            {visiblePermissions.map((p) => {
              const status = String(p.status ?? "pending");
              const titleStatus = status.charAt(0).toUpperCase() + status.slice(1);
              return (
                <li key={p.id} className="rounded-2xl border border-border bg-card p-4 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-sm">
                        <span>{t("permission")}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          • {p.duration_hours} {t("hoursShort")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.date)} • {p.start_time} → {p.end_time}
                      </p>
                      {p.reason && (
                        <p className="mt-1 text-[11px] text-muted-foreground">"{p.reason}"</p>
                      )}
                      {p.decision_note && (
                        <p className="mt-1 rounded-lg bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground">
                          Note: {p.decision_note}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                          statusTone[status] ?? "bg-muted"
                        }`}
                      >
                        {tStatus(titleStatus)}
                      </span>
                      {status === "pending" && (
                        <button
                          onClick={() => {
                            if (window.confirm(t("cancelPermissionConfirm"))) {
                              cancelPermMut.mutate(p.id);
                            }
                          }}
                          disabled={cancelPermMut.isPending}
                          className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                          title="Cancel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Show More / Show Less Permissions */}
          {hasMorePermissions && (
            <button
              type="button"
              onClick={() => setShowAllPermissions((prev) => !prev)}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/40 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
            >
              {showAllPermissions ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span>{t("showLess")}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span>
                    {t("showMorePermissions")} ({permissions.length - 3})
                  </span>
                </>
              )}
            </button>
          )}
        </section>
      )}

      {/* Leave Request Modal */}
      {leaveModalOpen && (
        <LeaveModal
          onClose={() => {
            setLeaveModalOpen(false);
            qc.invalidateQueries({ queryKey: ["my-leaves"] });
          }}
        />
      )}

      {/* Permission Request Modal */}
      {permModalOpen && (
        <PermissionModal
          quota={quota}
          onClose={() => {
            setPermModalOpen(false);
            qc.invalidateQueries({ queryKey: ["employee", "permissions"] });
          }}
        />
      )}
    </div>
  );
}

function LeaveModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const typesFn = useServerFn(listActiveLeaveTypes);
  const { data: types = [] } = useQuery({ queryKey: ["active-leave-types"], queryFn: () => typesFn() });
  const [type, setType] = useState("Annual Leave");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ name: string; mime: string; dataUrl: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const submitFn = useServerFn(submitLeave);

  const selectedType = (types as any[]).find((tp) => tp.name === type);
  const requiresProof = !!selectedType?.requires_proof;
  const MAX_PROOF = 1.5 * 1024 * 1024;
  const ALLOWED_PROOF = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

  async function onProof(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_PROOF.includes(f.type)) {
      setErr("Only PDF, PNG, or JPEG files are allowed.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_PROOF) {
      setErr("File must be 1.5 MB or smaller.");
      e.target.value = "";
      return;
    }
    setErr(null);
    const reader = new FileReader();
    reader.onload = () => setProof({ name: f.name, mime: f.type, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!start || !end) return setErr(t("errStartEnd"));
    if (new Date(end) < new Date(start)) return setErr(t("errEndBeforeStart"));
    if (reason.trim().length > 500) return setErr(t("errReasonLong"));
    if (requiresProof && !proof) return setErr("A doctor proof attachment is required for this leave type.");
    const days = daysBetween(start, end);
    setBusy(true);
    try {
      await submitFn({
        data: {
          leave_type_id: selectedType?.id ?? null,
          leave_type_name: type,
          start_date: start,
          end_date: end,
          days,
          paid: selectedType ? !!selectedType.paid : !/unpaid/i.test(type),
          reason: reason.trim() || undefined,
          proof_url: proof?.dataUrl ?? null,
          proof_mime: proof?.mime ?? null,
          proof_name: proof?.name ?? null,
        },
      });
      toast.success(t("leaveSubmitted"), {
        description: `${type}: ${start} → ${end}. ${t("awaitingReview")}`,
      });
      onClose();
    } catch (e: any) {
      const parsed = parseValidationError(e, "Failed to submit");
      setErr(
        fieldError(parsed, "from", "start_date") ??
          fieldError(parsed, "to", "end_date") ??
          parsed.message,
      );
    } finally {
      setBusy(false);
    }
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-4 md:items-center"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("newLeaveRequest")}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <Field label={t("type")}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            >
              {(types as any[]).length === 0 && <option value={type}>{type}</option>}
              {(types as any[]).map((tp) => (
                <option key={tp.id} value={tp.name}>
                  {tp.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("startDate")}>
              <input
                required
                min={todayISO}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                type="date"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label={t("endDate")}>
              <input
                required
                min={start || todayISO}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                type="date"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              />
            </Field>
          </div>
          {start && end && new Date(end) >= new Date(start) && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {t("requesting")}{" "}
              <span className="font-semibold text-foreground">
                {daysBetween(start, end)} {daysBetween(start, end) === 1 ? t("dayWord") : t("daysWord")}
              </span>
            </p>
          )}
          <Field label={t("reasonOptional")}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              placeholder={t("briefReason")}
            />
          </Field>
          {requiresProof && (
            <Field label="Doctor proof (PDF / PNG / JPEG, max 1.5 MB)">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg"
                onChange={onProof}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                >
                  <Paperclip className="h-3.5 w-3.5" /> {proof ? "Replace file" : "Attach file"}
                </button>
                {proof && (
                  <span className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> {proof.name}
                  </span>
                )}
              </div>
            </Field>
          )}
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
          <button
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("submitRequest")}
          </button>
        </form>
      </div>
    </div>
  );
}

function PermissionModal({
  onClose,
  quota,
}: {
  onClose: () => void;
  quota?: MonthlyPermissionQuota;
}) {
  const { t } = useI18n();
  const reqFn = useServerFn(requestPermission);

  const todayISO = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayISO);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [durationHours, setDurationHours] = useState(2.0);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    calcDuration(val, endTime);
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    calcDuration(startTime, val);
  };

  const calcDuration = (start: string, end: string) => {
    if (!start || !end) return;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (endMins > startMins) {
      const diff = (endMins - startMins) / 60;
      setDurationHours(Math.min(2.0, Math.max(0.5, Math.round(diff * 10) / 10)));
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!date) return setErr(t("permissionDate") + " required");
    if (!startTime || !endTime) return setErr(t("startTime") + " & " + t("endTime") + " required");
    if (!reason.trim()) return setErr(t("permissionReason") + " required");
    if (durationHours > 2.0) return setErr("Max 2.0 hours per request");
    if (durationHours <= 0) return setErr("End time must be after start time");
    if (quota && durationHours > quota.remainingHours) {
      return setErr(
        `Requested duration (${durationHours}h) exceeds remaining monthly quota (${quota.remainingHours.toFixed(1)}h).`,
      );
    }

    setBusy(true);
    try {
      await reqFn({
        data: {
          date,
          start_time: startTime,
          end_time: endTime,
          duration_hours: durationHours,
          reason: reason.trim(),
        },
      });
      toast.success(t("permissionSubmitted"), {
        description: `${date}: ${startTime} → ${endTime} (${durationHours}h)`,
      });
      onClose();
    } catch (e: any) {
      const parsed = parseValidationError(e, "Failed to submit permission");
      setErr(
        fieldError(parsed, "date") ??
          fieldError(parsed, "reason") ??
          fieldError(parsed, "duration_hours") ??
          parsed.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-4 md:items-center"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">{t("requestPermission")}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
          <p>{t("permissionPolicyNotice")}</p>
          {quota && (
            <p className="mt-1 font-semibold text-foreground">
              {t("remainingHours")}: {quota.remainingHours.toFixed(1)} {t("hoursShort")} • {quota.remainingCount}{" "}
              {t("requestShort")}
            </p>
          )}
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <Field label={t("permissionDate")}>
            <input
              required
              min={todayISO}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              type="date"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("startTime")}>
              <input
                required
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label={t("endTime")}>
              <input
                required
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              />
            </Field>
          </div>

          <Field label={`${t("permissionDuration")} (${t("hoursShort")}, max 2.0)`}>
            <input
              required
              type="number"
              step="0.5"
              min="0.5"
              max="2.0"
              value={durationHours}
              onChange={(e) => setDurationHours(Math.min(2.0, Math.max(0.5, Number(e.target.value))))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            />
          </Field>

          <Field label={t("permissionReason")}>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              placeholder={t("briefReason")}
            />
          </Field>

          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}

          <button
            disabled={busy || (quota ? !quota.canRequest : false)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("submitRequest")}
          </button>
        </form>
      </div>
    </div>
  );
}

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
