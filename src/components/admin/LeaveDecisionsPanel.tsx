import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck, Check, X, RefreshCw, BellRing } from "lucide-react";
import { getAdminAlerts, type AdminAlert } from "@/backend/functions/admin-dashboard-extras.functions";

type View = "all" | "approved" | "rejected";

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** In-app panel of recent leave approval / rejection decisions. */
export function LeaveDecisionsPanel() {
  const fn = useServerFn(getAdminAlerts);
  const [view, setView] = useState<View>("all");
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  const decisions = useMemo(
    () => ((data?.alerts ?? []) as AdminAlert[]).filter((a) => a.kind === "leave_decision"),
    [data],
  );
  const approved = decisions.filter((a) => /approved/i.test(a.description));
  const rejected = decisions.filter((a) => /rejected/i.test(a.description));
  const shown = view === "approved" ? approved : view === "rejected" ? rejected : decisions;

  const TABS: { id: View; label: string; count: number }[] = [
    { id: "all", label: "All decisions", count: decisions.length },
    { id: "approved", label: "Approved", count: approved.length },
    { id: "rejected", label: "Rejected", count: rejected.length },
  ];

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <BellRing className="h-4 w-4 text-brand" /> Decision notifications
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Approved and rejected leave requests from the last 30 days, shown here as well as by email.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((tb) => {
          const active = view === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setView(tb.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                active ? "bg-brand text-brand-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tb.label}
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-white/20" : "bg-background/60"}`}>
                {tb.count}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">No leave decisions yet.</div>
      ) : (
        <ul className="max-h-[320px] space-y-2 overflow-y-auto pe-1">
          {shown.map((a) => {
            const isApproved = /approved/i.test(a.description);
            const Icon = isApproved ? Check : /rejected/i.test(a.description) ? X : CheckCheck;
            return (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-3"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${
                    isApproved
                      ? "bg-success/10 text-success ring-success/20"
                      : "bg-destructive/10 text-destructive ring-destructive/20"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{a.description}</p>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{timeAgo(a.ts)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
