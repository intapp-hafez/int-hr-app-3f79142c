import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import {
  staffListAttendance,
  staffUpsertAttendance,
  staffApproveAttendance,
  staffListEmployees,
} from "@/backend/functions/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/staff/attendance")({
  component: StaffAttendance,
});

const STATUSES = ["present", "late", "absent", "leave"] as const;
type Status = (typeof STATUSES)[number];

const tone: Record<string, string> = {
  present: "bg-success/15 text-success",
  late: "bg-warning/20 text-warning-foreground",
  leave: "bg-info/15 text-info",
  absent: "bg-destructive/15 text-destructive",
};

function toHM(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

type Row = Awaited<ReturnType<typeof staffListAttendance>>[number];

function StaffAttendance() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(weekAgoStr());
  const [to, setTo] = useState(todayStr());
  const [editing, setEditing] = useState<Row | null>(null);

  const listFn = useServerFn(staffListAttendance);
  const upsertFn = useServerFn(staffUpsertAttendance);
  const approveFn = useServerFn(staffApproveAttendance);
  const empFn = useServerFn(staffListEmployees);

  const list = useQuery({
    queryKey: ["staff-att", from, to],
    queryFn: () => listFn({ data: { from, to } }),
  });
  const employees = useQuery({ queryKey: ["staff-emp"], queryFn: () => empFn() });

  const approve = useMutation({
    mutationFn: (v: { id: string; status: Status }) => approveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-att"] });
      toast.success("Attendance updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsert = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-att"] });
      toast.success("Saved");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];
  const pending = useMemo(() => rows.filter((r) => r.status === "late" || r.status === "absent").length, [rows]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Attendance</h1>
        <p className="text-xs text-muted-foreground">Approve or edit employee attendance entries.</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px]">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{rows.length} entries</span>
        <span className="rounded-full bg-warning/20 px-2 py-0.5 font-medium text-warning-foreground">
          {pending} need review
        </span>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {list.error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {(list.error as Error).message}
        </p>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.employee_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.date} · in {toHM(r.in_time)} · out {toHM(r.out_time)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone[r.status] ?? "bg-muted"}`}>
                {r.status}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              {r.status !== "present" && (
                <button
                  onClick={() => approve.mutate({ id: r.id, status: "present" })}
                  disabled={approve.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-success px-2 py-1.5 text-[11px] font-semibold text-success-foreground disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Approve
                </button>
              )}
            </div>
          </li>
        ))}
        {!list.isLoading && rows.length === 0 && (
          <p className="rounded-xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            No attendance entries in this range.
          </p>
        )}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit attendance</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                upsert.mutate({
                  id: editing.id,
                  employee_id: editing.employee_id,
                  date: String(f.get("date") || editing.date),
                  in_time: (f.get("in_time") as string) || null,
                  out_time: (f.get("out_time") as string) || null,
                  branch: (f.get("branch") as string) || null,
                  status: f.get("status") as Status,
                  note: (f.get("note") as string) || null,
                });
              }}
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">{editing.employee_name}</p>
              <div>
                <Label className="text-[11px]">Date</Label>
                <Input name="date" type="date" defaultValue={editing.date} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">In</Label>
                  <Input name="in_time" type="time" defaultValue={toHM(editing.in_time) === "—" ? "" : toHM(editing.in_time)} />
                </div>
                <div>
                  <Label className="text-[11px]">Out</Label>
                  <Input name="out_time" type="time" defaultValue={toHM(editing.out_time) === "—" ? "" : toHM(editing.out_time)} />
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Status</Label>
                <select
                  name="status"
                  defaultValue={editing.status}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[11px]">Branch</Label>
                <Input name="branch" defaultValue={editing.branch ?? ""} />
              </div>
              <div>
                <Label className="text-[11px]">Note</Label>
                <Input name="note" defaultValue={editing.note ?? ""} />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={upsert.isPending}>
                  {upsert.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {employees.error && (
        <p className="text-[11px] text-muted-foreground">Employee list unavailable.</p>
      )}
    </div>
  );
}