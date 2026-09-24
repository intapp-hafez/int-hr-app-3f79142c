import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Clock,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  Filter,
  Loader2,
  ShieldAlert,
  FileText,
  CalendarDays,
  Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  listPermissionsAdmin,
  decidePermission,
  requestPermission,
  type PermissionRow,
  type PermissionStatus,
} from "@/backend/functions/employee-permissions.functions";
import { listEmployeesForAccess } from "@/backend/functions/network-assignments.functions";

const statusColors: Record<PermissionStatus, string> = {
  approved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function PermissionsManager() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const listFn = useServerFn(listPermissionsAdmin);
  const decideFn = useServerFn(decidePermission);
  const requestFn = useServerFn(requestPermission);
  const empListFn = useServerFn(listEmployeesForAccess);

  const [statusFilter, setStatusFilter] = useState<"all" | PermissionStatus>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState("");
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [rejectingItem, setRejectingItem] = useState<PermissionRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // Request form state
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [reqDate, setReqDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [durationHours, setDurationHours] = useState(2.0);
  const [reqReason, setReqReason] = useState("");

  // Calculate duration whenever times change
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
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["admin", "permissions", statusFilter, selectedMonth, searchTerm],
    queryFn: () =>
      listFn({
        data: {
          status: statusFilter,
          month: selectedMonth || undefined,
          search: searchTerm,
        },
      }),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["admin", "employees-for-permissions"],
    queryFn: () => empListFn(),
  });

  // Mutations
  const decideMutation = useMutation({
    mutationFn: (vars: { id: string; status: "approved" | "rejected"; note?: string }) =>
      decideFn({ data: { id: vars.id, status: vars.status, decision_note: vars.note } }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === "approved" ? "Permission approved" : "Permission rejected");
      qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      qc.invalidateQueries({ queryKey: ["employee", "permissions"] });
      setRejectingItem(null);
      setRejectNote("");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update permission"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      requestFn({
        data: {
          employee_id: selectedEmpId || undefined,
          date: reqDate,
          start_time: startTime,
          end_time: endTime,
          duration_hours: durationHours,
          reason: reqReason,
        },
      }),
    onSuccess: () => {
      toast.success("Permission request submitted successfully");
      qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      qc.invalidateQueries({ queryKey: ["employee", "permissions"] });
      setIsRequestModalOpen(false);
      setReqReason("");
      setSelectedEmpId("");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to submit request"),
  });

  // Summary counts
  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    permissions.forEach((p) => {
      if (p.status === "pending") pending++;
      else if (p.status === "approved") approved++;
      else if (p.status === "rejected") rejected++;
    });
    return { all: permissions.length, pending, approved, rejected };
  }, [permissions]);

  return (
    <div className="space-y-6">
      {/* Top Banner: Policy Rules & Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 md:col-span-2">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Permission Policy</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Each employee is entitled to <span className="font-semibold text-foreground">4 hours</span> of permission per calendar month, usable in at most <span className="font-semibold text-foreground">2 requests</span> per month. Each single request may not exceed <span className="font-semibold text-foreground">2 hours</span>. Requires Admin or HR approval.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Pending Approvals</span>
            <div className="text-2xl font-bold text-amber-500">{counts.pending}</div>
          </div>
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "pending", "approved", "rejected", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t(s as any) || s}
              {s !== "all" && counts[s as keyof typeof counts] !== undefined && (
                <span className="ml-1 opacity-75">({counts[s as keyof typeof counts] ?? 0})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-xs">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none"
            />
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth("")}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="All Months"
              >
                ×
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("search") || "Search employee or reason…"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 rounded-xl border border-border bg-card py-1.5 pl-8 pr-3 text-xs outline-none focus:border-ring md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Permissions Table */}
      {isLoading ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading permissions…
        </div>
      ) : permissions.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <h4 className="text-sm font-semibold text-foreground">No permission requests found</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchTerm || statusFilter !== "all" || selectedMonth
              ? "Try adjusting your filters or search terms."
              : "No employee permissions have been requested yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">Employee</th>
                  <th className="px-4 py-3 text-start">Date</th>
                  <th className="px-4 py-3 text-start">Time Slot</th>
                  <th className="px-4 py-3 text-start">Duration</th>
                  <th className="px-4 py-3 text-start">Reason</th>
                  <th className="px-4 py-3 text-start">Status</th>
                  <th className="px-4 py-3 text-start">Decision Note</th>
                  <th className="px-4 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {permissions.map((p) => (
                  <tr key={p.id} className="transition hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2.5">
                        {p.employee_avatar ? (
                          <img
                            src={p.employee_avatar}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                            {p.employee_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{p.employee_name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {p.employee_code ? `[${p.employee_code}] ` : ""}
                            {p.department || "No department"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-foreground">
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

                    <td className="max-w-[200px] truncate px-4 py-3 text-foreground" title={p.reason}>
                      {p.reason}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          statusColors[p.status]
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="max-w-[160px] truncate px-4 py-3 text-muted-foreground" title={p.decision_note || ""}>
                      {p.decision_note ? (
                        <span>{p.decision_note}</span>
                      ) : p.decision_by_name ? (
                        <span className="text-[10px]">by {p.decision_by_name}</span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      {p.status === "pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => decideMutation.mutate({ id: p.id, status: "approved" })}
                            disabled={decideMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-600/20"
                            title="Approve"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectingItem(p);
                              setRejectNote("");
                            }}
                            disabled={decideMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                            title="Reject"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {p.status === "approved" ? "Approved" : p.status === "rejected" ? "Rejected" : "Cancelled"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="font-semibold text-foreground">Reject Permission Request</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Rejecting permission for <span className="font-semibold text-foreground">{rejectingItem.employee_name}</span> on {rejectingItem.date} ({rejectingItem.duration_hours}h).
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-foreground">Reason / Note (optional)</label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Specify the reason for rejection…"
                rows={3}
                className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => decideMutation.mutate({ id: rejectingItem.id, status: "rejected", note: rejectNote })}
                disabled={decideMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3.5 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                {decideMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">New Permission Request</h3>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Policy note */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300">
                <p className="font-semibold">Policy limits:</p>
                <p>• Max 4.0 hours permission per month</p>
                <p>• Max 2 permission requests per month</p>
                <p>• Max 2.0 hours per single request</p>
              </div>

              {/* Employee selector */}
              <div>
                <label className="mb-1 block font-medium text-foreground">Select Employee *</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
                >
                  <option value="">Select an employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.emp_code ? `(${emp.emp_code})` : ""} {emp.department ? `- ${emp.department}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 block font-medium text-foreground">Date *</label>
                <input
                  type="date"
                  value={reqDate}
                  onChange={(e) => setReqDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
                />
              </div>

              {/* Time window */}
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

              {/* Duration */}
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

              {/* Reason */}
              <div>
                <label className="mb-1 block font-medium text-foreground">Reason *</label>
                <textarea
                  rows={3}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Provide a reason for the permission request…"
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus:border-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selectedEmpId) return toast.error("Please select an employee");
                  if (!reqReason.trim()) return toast.error("Reason is required");
                  if (durationHours > 2.0) return toast.error("Maximum 2 hours per request");
                  createMutation.mutate();
                }}
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
