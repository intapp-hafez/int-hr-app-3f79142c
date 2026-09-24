import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Clock,
  Plus,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  CalendarDays,
  ShieldCheck,
  Check,
  X,
  FileText,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  listEmployeePermissions,
  requestPermission,
  decidePermission,
  cancelPermission,
  type PermissionRow,
  type PermissionStatus,
} from "@/backend/functions/employee-permissions.functions";

const statusTone: Record<PermissionStatus, string> = {
  approved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function EmployeePermissionsPanel({
  employeeId,
  canManage = true,
}: {
  employeeId?: string;
  canManage?: boolean;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const listFn = useServerFn(listEmployeePermissions);
  const reqFn = useServerFn(requestPermission);
  const decideFn = useServerFn(decidePermission);
  const cancelFn = useServerFn(cancelPermission);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal form state
  const [reqDate, setReqDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [durationHours, setDurationHours] = useState(2.0);
  const [reason, setReason] = useState("");

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
      setDurationHours(Math.min(2.0, Math.round(diff * 10) / 10));
    }
  };

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["employee", "permissions", employeeId ?? "me", selectedMonth],
    queryFn: () => listFn({ data: { employee_id: employeeId || undefined, month: selectedMonth } }),
  });

  const permissions = data?.permissions ?? [];
  const quota = data?.quota;

  // Mutations
  const createMut = useMutation({
    mutationFn: () =>
      reqFn({
        data: {
          employee_id: employeeId || undefined,
          date: reqDate,
          start_time: startTime,
          end_time: endTime,
          duration_hours: durationHours,
          reason,
        },
      }),
    onSuccess: () => {
      toast.success("Permission request submitted");
      qc.invalidateQueries({ queryKey: ["employee", "permissions"] });
      qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      setIsModalOpen(false);
      setReason("");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to submit request"),
  });

  const decideMut = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) =>
      decideFn({ data: { id: v.id, status: v.status } }),
    onSuccess: (_, v) => {
      toast.success(v.status === "approved" ? "Permission approved" : "Permission rejected");
      qc.invalidateQueries({ queryKey: ["employee", "permissions"] });
      qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Permission request cancelled");
      qc.invalidateQueries({ queryKey: ["employee", "permissions"] });
      qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to cancel"),
  });

  return (
    <div className="space-y-6">
      {/* Policy banner & Quota stats */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              <span>Work Permission Balance & Quota</span>
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Monthly Allowance: 4 hours max • Max 2 requests per month • Max 2 hours per request
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-medium text-foreground outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={quota ? !quota.canRequest : false}
              title={quota && !quota.canRequest ? "Monthly quota exhausted (4h or 2 requests reached)" : "Request permission"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{t("requestPermission") || "Request Permission"}</span>
            </button>
          </div>
        </div>

        {/* Quota KPI Cards */}
        {quota && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Hours card */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-muted/30 p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">Monthly Hours</span>
                <div className="mt-1 flex items-baseline justify-between gap-1.5">
                  <span className="font-display text-base font-semibold tabular-nums text-foreground whitespace-nowrap">
                    {quota.usedHours.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">/ {quota.maxHours.toFixed(1)} hrs</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    <strong className="text-foreground">{quota.remainingHours.toFixed(1)}</strong> hrs left
                  </span>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, ((quota.usedHours + quota.pendingHours) / quota.maxHours) * 100)}%`,
                    }}
                  />
                </div>
                {quota.pendingHours > 0 && (
                  <p className="mt-1 text-[10px] text-amber-500 font-medium">({quota.pendingHours.toFixed(1)}h pending)</p>
                )}
              </div>
            </div>

            {/* Requests Count card */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-muted/30 p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">Monthly Requests</span>
                <div className="mt-1 flex items-baseline justify-between gap-1.5">
                  <span className="font-display text-base font-semibold tabular-nums text-foreground whitespace-nowrap">
                    {quota.usedCount}{" "}
                    <span className="text-xs font-normal text-muted-foreground">/ {quota.maxRequests}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    <strong className="text-foreground">{quota.remainingCount}</strong> left
                  </span>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(100, (quota.usedCount / quota.maxRequests) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Quota Status */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-muted/30 p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">Status</span>
                <div className="mt-1.5">
                  {quota.canRequest ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Eligible</span>
                    </span>
                  ) : (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Quota Exhausted</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                Max 2.0h per request
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Permissions History Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xs">
        <div className="border-b border-border p-4">
          <h4 className="text-sm font-semibold text-foreground">Permissions History</h4>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
            Loading permissions…
          </div>
        ) : permissions.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <p>No permission requests recorded for this period.</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={quota ? !quota.canRequest : false}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("requestPermission") || "Request Permission"}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">Date</th>
                  <th className="px-4 py-3 text-start">Time Slot</th>
                  <th className="px-4 py-3 text-start">Duration</th>
                  <th className="px-4 py-3 text-start">Reason</th>
                  <th className="px-4 py-3 text-start">Status</th>
                  <th className="px-4 py-3 text-start">Note / Approver</th>
                  <th className="px-4 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {permissions.map((p) => (
                  <tr key={p.id} className="transition hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      {p.date}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      <span className="font-mono">{p.start_time}</span> -{" "}
                      <span className="font-mono">{p.end_time}</span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-md bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground">
                        {p.duration_hours} hrs
                      </span>
                    </td>

                    <td className="max-w-[220px] truncate px-4 py-3 text-foreground" title={p.reason}>
                      {p.reason}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          statusTone[p.status]
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">
                      {p.decision_note ? (
                        <span title={p.decision_note}>{p.decision_note}</span>
                      ) : p.decision_by_name ? (
                        <span className="text-[10px]">by {p.decision_by_name}</span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      {p.status === "pending" && (
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && (
                            <>
                              <button
                                onClick={() => decideMut.mutate({ id: p.id, status: "approved" })}
                                disabled={decideMut.isPending}
                                className="rounded-lg bg-emerald-500/10 p-1 text-emerald-600 hover:bg-emerald-500/20"
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => decideMut.mutate({ id: p.id, status: "rejected" })}
                                disabled={decideMut.isPending}
                                className="rounded-lg bg-destructive/10 p-1 text-destructive hover:bg-destructive/20"
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => cancelMut.mutate(p.id)}
                            disabled={cancelMut.isPending}
                            className="rounded-lg border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Request Permission</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
                Maximum 2.0 hours per request. Remaining monthly quota:{" "}
                <strong className="text-foreground">{quota?.remainingHours.toFixed(1) ?? 4.0} hrs</strong>.
              </div>

              <div>
                <label className="mb-1 block font-medium text-foreground">Date *</label>
                <input
                  type="date"
                  value={reqDate}
                  onChange={(e) => setReqDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Start Time *</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">End Time *</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="mb-1 block font-medium text-foreground">Duration (Hours) *</label>
                  <span className="text-[11px] text-muted-foreground">Max 2.0 hrs</span>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="2.0"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Math.min(2.0, Math.max(0.25, Number(e.target.value))))}
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-foreground">Reason *</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the reason for permission…"
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!reason.trim()) return toast.error("Reason is required");
                  if (durationHours > 2.0) return toast.error("Maximum 2 hours per request");
                  createMut.mutate();
                }}
                disabled={createMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {createMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
