import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Paperclip, Mail, MailX, Search, Inbox } from "lucide-react";
import {
  listLeaveQueue,
  decideLeave,
  decideLeavesBulk,
  type LeaveQueueRow,
} from "@/backend/functions/leaves.functions";
import { formatDate } from "@/lib/date-format";

export const Route = createFileRoute("/admin/leaves-requests")({ component: LeaveApprovalQueue });

const tone: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

type Filter = "pending" | "approved" | "rejected" | "cancelled" | "all";
const FILTERS: Filter[] = ["pending", "approved", "rejected", "cancelled", "all"];

function LeaveApprovalQueue() {
  const qc = useQueryClient();
  const list = useServerFn(listLeaveQueue);
  const decide = useServerFn(decideLeave);
  const bulkDecide = useServerFn(decideLeavesBulk);

  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [notify, setNotify] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const q = useQuery({ queryKey: ["leave-queue"], queryFn: () => list() });
  const rows: LeaveQueueRow[] = q.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["leave-queue"] });
    qc.invalidateQueries({ queryKey: ["leaves-all"] });
    qc.invalidateQueries({ queryKey: ["admin", "leaves"] });
    qc.invalidateQueries({ queryKey: ["admin", "leave-balances"] });
  };

  const m = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" | "cancelled" }) =>
      decide({ data: { ...v, notify } }),
    onSuccess: (r: any, v) => {
      toast.success(
        `${v.status === "approved" ? "Approved" : v.status === "rejected" ? "Rejected" : "Cancelled"}${
          r?.notified ? " · employee notified by email" : notify ? " · email not sent" : ""
        }`,
      );
      setSelected((s) => {
        const n = { ...s };
        delete n[v.id];
        return n;
      });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: (v: { ids: string[]; status: "approved" | "rejected" }) =>
      bulkDecide({ data: { ...v, notify } }),
    onSuccess: (r: any) => {
      toast.success(`${r?.done ?? 0} request(s) updated${r?.failed?.length ? `, ${r.failed.length} failed` : ""}`);
      if (r?.failed?.length) toast.error(r.failed[0].message);
      setSelected({});
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0, all: rows.length };
    rows.forEach((r) => {
      if (r.status in c) c[r.status as Filter] += 1;
    });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!term) return true;
      return [r.employee_name, r.employee_email, r.department, r.leave_type_name, r.reason]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, filter, search]);

  const selectableIds = visible.filter((r) => r.status === "pending").map((r) => r.id);
  const selectedIds = selectableIds.filter((id) => selected[id]);
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;

  function toggleAll() {
    if (allSelected) return setSelected({});
    const next: Record<string, boolean> = {};
    selectableIds.forEach((id) => (next[id] = true));
    setSelected(next);
  }

  const busy = m.isPending || bulk.isPending;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Leave Approval Queue</h1>
          <p className="text-sm text-muted-foreground">
            Review pending requests and decide before any notification email is sent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNotify((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
              notify ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"
            }`}
            title="Toggle whether the employee is emailed after a decision"
          >
            {notify ? <Mail className="h-3.5 w-3.5" /> : <MailX className="h-3.5 w-3.5" />}
            {notify ? "Email on decision: ON" : "Email on decision: OFF"}
          </button>
          <span className="rounded-full bg-warning/20 px-3 py-1.5 text-xs font-semibold text-warning-foreground">
            {counts.pending} pending
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setSelected({});
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, type, reason…"
            className="w-64 rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {selectableIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
            Select all pending ({selectableIds.length})
          </label>
          <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
          <div className="ml-auto flex gap-2">
            <button
              disabled={selectedIds.length === 0 || busy}
              onClick={() => bulk.mutate({ ids: selectedIds, status: "approved" })}
              className="inline-flex items-center gap-1 rounded-xl bg-success px-3 py-2 text-xs font-semibold text-success-foreground disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Approve selected
            </button>
            <button
              disabled={selectedIds.length === 0 || busy}
              onClick={() => bulk.mutate({ ids: selectedIds, status: "rejected" })}
              className="inline-flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Reject selected
            </button>
          </div>
        </div>
      )}

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{(q.error as Error).message}</p>
      )}
      {!q.isLoading && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border p-10 text-center">
          <Inbox className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing in this queue.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((l) => (
          <div key={l.id} className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {l.status === "pending" && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={!!selected[l.id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [l.id]: e.target.checked }))}
                  />
                )}
                <div>
                  <p className="font-semibold">{l.employee_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {l.leave_type_name ?? "Leave"}
                    {l.department ? ` · ${l.department}` : ""}
                    {l.paid == null ? "" : l.paid ? " · paid" : " · unpaid"}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone[l.status] ?? "bg-muted"}`}
              >
                {l.status}
              </span>
            </div>

            <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span className="font-medium">{formatDate(l.start_date)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-medium">{formatDate(l.end_date)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Days</span>
                <span className="font-medium">{l.days}</span>
              </div>
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

            {l.status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => m.mutate({ id: l.id, status: "approved" })}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-success px-3 py-2 text-xs font-semibold text-success-foreground disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => m.mutate({ id: l.id, status: "rejected" })}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            ) : (
              l.status === "approved" && (
                <button
                  disabled={busy}
                  onClick={() => m.mutate({ id: l.id, status: "cancelled" })}
                  className="mt-3 w-full rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
                >
                  Revoke approval
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
