import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Play, CheckCircle2, Route as RouteIcon, Flag, StickyNote, Calendar } from "lucide-react";
import { listActivityRange } from "@/backend/functions/activity.functions";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/activity-timeline/$id")({
  component: EmployeeActivityTimeline,
});

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const KIND_META: Record<string, { label: string; Icon: typeof Play; tone: string }> = {
  start_task:    { label: "Start task",    Icon: Play,        tone: "bg-brand/15 text-brand" },
  complete_task: { label: "Complete task", Icon: CheckCircle2, tone: "bg-success/15 text-success" },
  start_trip:    { label: "Start trip",    Icon: RouteIcon,   tone: "bg-info/15 text-info" },
  complete_trip: { label: "Complete trip", Icon: Flag,        tone: "bg-warning/20 text-warning-foreground" },
};

function EmployeeActivityTimeline() {
  const { id } = Route.useParams();
  const employees = useStore((s) => s.employees);
  const emp = employees.find((e) => e.id === id);

  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());

  const fn = useServerFn(listActivityRange);
  const q = useQuery({
    queryKey: ["employee-activity-timeline", id, from, to],
    queryFn: () => fn({ data: { from, to, employeeIds: [id] } }),
  });

  const grouped = useMemo(() => {
    const rows = (q.data ?? []) as any[];
    // newest first
    const sorted = [...rows].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    const byDay = new Map<string, any[]>();
    for (const r of sorted) {
      const day = new Date(r.occurred_at).toISOString().slice(0, 10);
      const arr = byDay.get(day) ?? [];
      arr.push(r);
      byDay.set(day, arr);
    }
    return Array.from(byDay.entries());
  }, [q.data]);

  const total = (q.data ?? []).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/admin/attendance"
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to attendance
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            {emp?.name ?? "Employee"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Task activity timeline · {total} event{total === 1 ? "" : "s"} between {formatDateRange(from, to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <DateRangeField className="w-72" from={from} to={to} onFromChange={setFrom} onToChange={setTo} error={rangeError} />
        </div>
      </div>

      {q.isLoading && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Loading timeline…
        </div>
      )}
      {q.error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
          {(q.error as Error).message}
        </p>
      )}
      {!q.isLoading && total === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No task activity recorded for this range.
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([day, rows]) => (
          <section key={day} className="rounded-3xl border border-border bg-card p-4">
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold">
                {new Date(day).toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {rows.length} event{rows.length === 1 ? "" : "s"}
              </span>
            </header>
            <ol className="relative ms-2 space-y-3 border-s border-border ps-4">
              {rows.map((r: any) => {
                const meta = KIND_META[r.kind] ?? { label: r.kind, Icon: Play, tone: "bg-muted text-foreground" };
                const Icon = meta.Icon;
                const location = [r.district, r.city].filter(Boolean).join(" — ") || r.task_address || "Location unknown";
                const time = new Date(r.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                return (
                  <li key={r.id} className="relative">
                    <span className={`absolute -start-[26px] top-1 grid h-5 w-5 place-items-center rounded-full ${meta.tone}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}>
                            {meta.label}
                          </span>
                          <span className="truncate">{r.task_name || "—"}</span>
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {location}
                          {(r.lat != null && r.lng != null) && (
                            <span className="ms-1 font-mono text-[10px]" dir="ltr">
                              · {Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}
                            </span>
                          )}
                        </p>
                        {r.note && (
                          <p className="mt-1 inline-flex items-start gap-1 rounded-lg bg-muted/40 px-2 py-1 text-[11px] italic text-muted-foreground">
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" /> {r.note}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{time}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}