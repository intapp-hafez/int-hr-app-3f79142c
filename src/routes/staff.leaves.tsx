import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Paperclip, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { staffListLeaves, staffDecideLeave } from "@/backend/functions/staff.functions";

export const Route = createFileRoute("/staff/leaves")({
  component: StaffLeaves,
});

const tone: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

type Filter = "pending" | "all";

function StaffLeaves() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const listFn = useServerFn(staffListLeaves);
  const decideFn = useServerFn(staffDecideLeave);

  const q = useQuery({ queryKey: ["staff-leaves"], queryFn: () => listFn() });
  const m = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) => decideFn({ data: v }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["staff-leaves"] });
      toast.success(
        v.status === "approved"
          ? "Approved · employee notified"
          : "Rejected · employee notified",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = q.data ?? [];
  const rows = filter === "pending" ? all.filter((r) => r.status === "pending") : all;
  const pendingCount = all.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leave Requests</h1>
          <p className="text-xs text-muted-foreground">Approve or reject. Employees receive a notification.</p>
        </div>
        <span className="rounded-full bg-warning/20 px-2 py-1 text-[11px] font-semibold text-warning-foreground">
          {pendingCount} pending
        </span>
      </header>

      <div className="flex gap-1 rounded-full bg-muted p-1 text-xs">
        {(["pending", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium capitalize ${
              filter === f ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{(q.error as Error).message}</p>}

      <ul className="space-y-2">
        {rows.map((l) => (
          <li key={l.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{l.employee_name}</p>
                <p className="text-[11px] text-muted-foreground">{l.leave_type_name ?? "Leave"}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone[l.status] ?? "bg-muted"}`}>
                {l.status}
              </span>
            </div>
            <div className="mt-2 rounded-xl bg-muted/50 p-2 text-[11px]">
              <div className="flex justify-between"><span className="text-muted-foreground">From</span><span className="font-medium">{l.start_date}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">To</span><span className="font-medium">{l.end_date}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Days</span><span className="font-medium">{l.days}</span></div>
              {l.reason && <p className="mt-1 italic text-muted-foreground">"{l.reason}"</p>}
            </div>
            {l.proof_url && (
              <a
                href={l.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                download={l.proof_name ?? undefined}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
              >
                <Paperclip className="h-3 w-3" /> {l.proof_name ?? "View proof"}
              </a>
            )}
            {l.requires_proof && !l.proof_url && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
                <AlertTriangle className="h-3 w-3" /> Proof required — cannot approve
              </p>
            )}
            {l.status === "pending" && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => m.mutate({ id: l.id, status: "approved" })}
                  disabled={m.isPending || (l.requires_proof && !l.proof_url)}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-success px-2 py-1.5 text-[11px] font-semibold text-success-foreground disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Approve
                </button>
                <button
                  onClick={() => m.mutate({ id: l.id, status: "rejected" })}
                  disabled={m.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] font-semibold text-destructive disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Reject
                </button>
              </div>
            )}
          </li>
        ))}
        {!q.isLoading && rows.length === 0 && (
          <p className="rounded-xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            Nothing to review.
          </p>
        )}
      </ul>
    </div>
  );
}