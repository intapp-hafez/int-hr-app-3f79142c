import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { listTripHistory } from "@/backend/functions/trips.functions";

export const Route = createFileRoute("/manager/trip-history")({
  head: () => ({
    meta: [
      { title: "Trip history — Manager" },
      { name: "description", content: "Start, finish and allowance changes for every team trip." },
      { property: "og:title", content: "Trip history — Manager" },
      { property: "og:description", content: "Start, finish and allowance changes for every team trip." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TripHistoryPage,
});

const EVENT_LABEL: Record<string, string> = {
  created: "Created", started: "Started", finished: "Finished",
  cancelled: "Cancelled", status: "Status changed", allowance: "Allowance changed",
};
const EVENT_CLASS: Record<string, string> = {
  created: "bg-muted text-foreground", started: "bg-brand/10 text-brand",
  finished: "bg-success/10 text-success", cancelled: "bg-muted text-muted-foreground",
  status: "bg-muted text-foreground", allowance: "bg-warning/10 text-warning",
};
const fmtMoney = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toLocaleString()} EGP`);
const fmtDate = (s: string) => {
  const d = new Date(s);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function TripHistoryPage() {
  const fn = useServerFn(listTripHistory);
  const { data, isLoading, error } = useQuery({ queryKey: ["trip-history"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const [ev, setEv] = useState("all");

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (ev !== "all" && r.event !== ev) return false;
      if (ql && !`${r.destination} ${r.assigneeName} ${r.changedByName}`.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [data, q, ev]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Trip history</h1>
        <p className="text-sm text-muted-foreground">Every start, finish and allowance change for your team's trips.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-soft grid gap-2 md:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trip, employee…" className="input ps-9" />
        </div>
        <select value={ev} onChange={(e) => setEv(e.target.value)} className="input">
          <option value="all">All changes</option>
          {Object.entries(EVENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">{(error as Error).message}</div>
      ) : data?.notSetUp ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm">
          Trip history isn't set up yet. Run <code>docs/migrations/055-trip-history.sql</code> in the Supabase SQL editor.
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">No trip changes yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-3 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{r.destination}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.tripDate} • Assigned to {r.assigneeName}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVENT_CLASS[r.event] ?? ""}`}>{EVENT_LABEL[r.event] ?? r.event}</span>
              </div>
              <p className="mt-2 text-xs">
                {r.event === "allowance" ? (
                  <>Allowance: {fmtMoney(r.allowanceBefore)} → <b>{fmtMoney(r.allowanceAfter)}</b>
                    {r.allowanceStatusBefore !== r.allowanceStatusAfter && <> · {r.allowanceStatusBefore ?? "—"} → <b>{r.allowanceStatusAfter ?? "—"}</b></>}
                  </>
                ) : r.event === "created" ? (
                  <>Allowance: <b>{fmtMoney(r.allowanceAfter)}</b> ({r.allowanceStatusAfter ?? "—"})</>
                ) : (
                  <>Status: {r.fromStatus ?? "—"} → <b>{r.toStatus}</b></>
                )}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(r.createdAt)} • by {r.changedByName}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
