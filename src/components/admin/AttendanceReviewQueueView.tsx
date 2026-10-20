import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldAlert, CheckCircle2, XCircle, Clock, MapPin,
  AlertTriangle, Check, X, RefreshCw, UserCheck, Search, Filter
} from "lucide-react";
import {
  listAttendanceReviewCases,
  resolveAttendanceReviewCase,
} from "@/backend/functions/attendance.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { formatDate } from "@/lib/date-format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

const REASON_LABELS: Record<string, { label: string; desc: string }> = {
  gps_boundary_uncertain: {
    label: "Boundary Uncertain",
    desc: "Reported GPS accuracy circle straddles the worksite geofence edge.",
  },
  gps_stale: {
    label: "Stale GPS Fix",
    desc: "GPS coordinates were cached (>30s old) when submitted.",
  },
  gps_perfect_accuracy: {
    label: "Suspiciously Perfect GPS",
    desc: "Reported accuracy is ≤2m, which is typical of emulators or software spoofers.",
  },
  gps_poor_accuracy: {
    label: "Weak Satellite Reception",
    desc: "Indoor or obstructed GPS signal with uncertainty >80m.",
  },
  impossible_travel: {
    label: "Implausible Travel Speed",
    desc: "Location jumped at >120 km/h from last accepted attendance point.",
  },
  gps_single_sample: {
    label: "Single Sample",
    desc: "Device only provided a single GPS reading before submitting.",
  },
};

export function AttendanceReviewQueueView() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAttendanceReviewCases);
  const resolveFn = useServerFn(resolveAttendanceReviewCase);

  const [filterStatus, setFilterStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCase, setSelectedCase] = useState<{ id: string; action: "approved" | "rejected"; empName: string } | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");

  const casesQ = useQuery({
    queryKey: ["admin", "attendance-review-cases", filterStatus],
    queryFn: () => listFn({ data: { status: filterStatus } }),
    refetchInterval: 15000,
  });

  const cases = (casesQ.data ?? []) as any[];

  const filteredCases = cases.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = c.profiles?.full_name?.toLowerCase() ?? "";
    const email = c.profiles?.email?.toLowerCase() ?? "";
    const code = c.profiles?.emp_code?.toLowerCase() ?? "";
    return name.includes(term) || email.includes(term) || code.includes(term);
  });

  const resolveM = useMutation({
    mutationFn: (args: { caseId: string; decision: "approved" | "rejected"; note?: string }) =>
      resolveFn({ data: args }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.decision === "approved"
          ? "Attendance approved and accepted"
          : "Attendance flagged as rejected"
      );
      qc.invalidateQueries({ queryKey: ["admin", "attendance-review-cases"] });
      qc.invalidateQueries({ queryKey: ["admin", "attendance"] });
      setSelectedCase(null);
      setReviewerNote("");
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to resolve review case");
    },
  });

  function handleActionClick(caseId: string, action: "approved" | "rejected", empName: string) {
    setSelectedCase({ id: caseId, action, empName });
    setReviewerNote("");
  }

  function handleConfirmResolve() {
    if (!selectedCase) return;
    resolveM.mutate({
      caseId: selectedCase.id,
      decision: selectedCase.action,
      note: reviewerNote.trim() || undefined,
    });
  }

  const pendingCount = filterStatus === "pending"
    ? cases.length
    : cases.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Attendance Review Queue
            </h2>
            {pendingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Review edge cases flagged for geofence boundary uncertainty, weak signals, or GPS drift.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-48 pl-8 text-xs"
            />
          </div>

          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                  filterStatus === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => casesQ.refetch()}
            disabled={casesQ.isFetching}
            className="h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${casesQ.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Cases Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-start">Employee</th>
              <th className="px-4 py-3 text-start">Action & Date</th>
              <th className="px-4 py-3 text-start">Flagged Reason</th>
              <th className="px-4 py-3 text-start">GPS Telemetry</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-end">Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {casesQ.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-muted-foreground" />
                  Loading review cases...
                </td>
              </tr>
            ) : filteredCases.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <UserCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="font-medium text-foreground">No review cases found</p>
                  <p className="text-xs text-muted-foreground">
                    {filterStatus === "pending"
                      ? "All attendance check-ins are currently verified and clear."
                      : "No cases match the selected status filter."}
                  </p>
                </td>
              </tr>
            ) : (
              filteredCases.map((c) => {
                const emp = c.profiles;
                const att = c.attendance;
                const isCheckIn = c.action === "check_in";
                const reasons: string[] = Array.isArray(c.reason_codes) ? c.reason_codes : [];
                const accuracy = isCheckIn ? att?.accuracy_m : att?.out_accuracy_m;
                const lat = isCheckIn ? att?.lat : att?.out_lat;
                const lng = isCheckIn ? att?.lng : att?.out_lng;

                return (
                  <tr key={c.id} className="hover:bg-muted/20">
                    {/* Employee */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar
                          id={c.employee_id}
                          name={emp?.full_name ?? "Employee"}
                          className="h-8 w-8"
                        />
                        <div>
                          <p className="font-medium leading-none text-foreground">
                            {emp?.full_name ?? emp?.email ?? "Unknown"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {emp?.emp_code ? `Code: ${emp.emp_code}` : emp?.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Action & Date */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            isCheckIn
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {isCheckIn ? "Check In" : "Check Out"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {att?.date ? formatDate(att.date) : formatDate(c.created_at)}
                      </p>
                    </td>

                    {/* Reasons */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {reasons.length > 0 ? (
                          reasons.map((r) => {
                            const meta = REASON_LABELS[r];
                            return (
                              <span
                                key={r}
                                title={meta?.desc ?? r}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                {meta?.label ?? r}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">Unspecified signal</span>
                        )}
                      </div>
                    </td>

                    {/* GPS Telemetry */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        {accuracy != null && (
                          <span>
                            Accuracy: <strong className="text-foreground">±{Math.round(accuracy)}m</strong>
                          </span>
                        )}
                        {lat != null && lng != null ? (
                          <span className="text-[11px] font-mono opacity-80">
                            {lat.toFixed(5)}, {lng.toFixed(5)}
                          </span>
                        ) : (
                          <span className="italic">No coordinates</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {c.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                      {c.status === "approved" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Approved
                        </span>
                      )}
                      {c.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                          <XCircle className="h-3 w-3" /> Rejected
                        </span>
                      )}
                      {c.reviewer_note && (
                        <p className="mt-1 max-w-[180px] truncate text-[11px] text-muted-foreground" title={c.reviewer_note}>
                          "{c.reviewer_note}"
                        </p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-end">
                      {c.status === "pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleActionClick(c.id, "approved", emp?.full_name ?? "Employee")}
                            className="h-8 gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleActionClick(c.id, "rejected", emp?.full_name ?? "Employee")}
                            className="h-8 gap-1 rounded-lg border-destructive/30 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Resolved {c.resolved_at ? formatDate(c.resolved_at) : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCase?.action === "approved" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Approve Attendance
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Reject Attendance
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedCase?.action === "approved"
                ? `Confirm presence for ${selectedCase?.empName}. The attendance record will be marked as accepted.`
                : `Reject attendance for ${selectedCase?.empName}. The attendance decision will remain rejected.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Reviewer Note (Optional)
            </label>
            <Input
              placeholder={
                selectedCase?.action === "approved"
                  ? "e.g., Verified on-site via supervisor / indoor GPS drift confirmed"
                  : "e.g., Confirmed employee was not on-site"
              }
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedCase(null)}
              disabled={resolveM.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={selectedCase?.action === "approved" ? "default" : "destructive"}
              onClick={handleConfirmResolve}
              disabled={resolveM.isPending}
              className={selectedCase?.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {resolveM.isPending ? "Saving..." : selectedCase?.action === "approved" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
