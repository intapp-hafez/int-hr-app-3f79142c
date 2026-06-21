import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Paperclip } from "lucide-react";
import { listAllLeaves, decideLeave } from "@/backend/functions/leaves.functions";

export const Route = createFileRoute("/admin/leaves-requests")({ component: LeaveRequests });

const tone: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

function LeaveRequests() {
  const qc = useQueryClient();
  const list = useServerFn(listAllLeaves);
  const decide = useServerFn(decideLeave);
  const q = useQuery({ queryKey: ["leaves-all"], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" | "cancelled" }) => decide({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves-all"] }); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const pending = rows.filter((r: any) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Leave Requests</h1>
          <p className="text-sm text-muted-foreground">Approve, reject, or review live leave requests.</p>
        </div>
        <span className="rounded-full bg-warning/20 px-3 py-1.5 text-xs font-semibold text-warning-foreground">{pending} pending</span>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{(q.error as Error).message}</p>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((l: any) => (
          <div key={l.id} className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{l.leave_type_name ?? "Leave"}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{l.employee_id.slice(0, 8)}…</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone[l.status] ?? "bg-muted"}`}>{l.status}</span>
            </div>
            <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">From</span><span className="font-medium">{l.start_date}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">To</span><span className="font-medium">{l.end_date}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Days</span><span className="font-medium">{l.days}</span></div>
              {l.reason && <p className="mt-2 italic text-muted-foreground">"{l.reason}"</p>}
            </div>
            {l.proof_url && (
              <a
                href={l.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                download={l.proof_name ?? undefined}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
              >
                <Paperclip className="h-3 w-3" /> {l.proof_name ?? "View proof"}
              </a>
            )}
            {l.status === "pending" && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => m.mutate({ id: l.id, status: "approved" })} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-success px-3 py-2 text-xs font-semibold text-success-foreground">
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button onClick={() => m.mutate({ id: l.id, status: "rejected" })} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}