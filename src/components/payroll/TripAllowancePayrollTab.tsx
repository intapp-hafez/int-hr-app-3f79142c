import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, CheckCircle2, Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { listMonthlyTripAllowances, saveMonthlyTripAllowances, setMonthlyTripAllowanceStatus } from "@/backend/functions/trip-allowance.functions";

export function TripAllowancePayrollTab({ year, month }: { year: number; month: number }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMonthlyTripAllowances);
  const saveFn = useServerFn(saveMonthlyTripAllowances);
  const statusFn = useServerFn(setMonthlyTripAllowanceStatus);
  const [open, setOpen] = useState<string | null>(null);
  const key = ["monthly-trip-allowances", year, month];
  const { data: rows = [], isLoading, error } = useQuery({ queryKey: key, queryFn: () => listFn({ data: { year, month } }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["payroll"] }); };
  const save = useMutation({ mutationFn: () => saveFn({ data: { year, month } }), onSuccess: (r) => { toast.success(`Saved ${r.saved} employees`); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const status = useMutation({
    mutationFn: (v: { ids: string[]; status: "draft" | "approved" }) => statusFn({ data: { year, month, employee_ids: v.ids, status: v.status } }),
    onSuccess: () => { toast.success("Updated — approved amounts are added to payroll"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const drafts = rows.filter((r) => r.saved && r.status === "draft").map((r) => r.employee_id);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const fmtD = (d: string) => d.split("-").reverse().join("-");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Trip allowances · {String(month).padStart(2, "0")}-{year}</h2>
          <p className="text-sm text-muted-foreground">Check-in days at a work location × position rate, plus approved finished trips. Only <b>approved</b> rows are added to payroll.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Calculate & save
          </button>
          <button onClick={() => status.mutate({ ids: drafts, status: "approved" })} disabled={!drafts.length || status.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Approve all ({drafts.length})
          </button>
        </div>
      </div>
      {isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        : error ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{(error as Error).message}</p>
        : rows.length === 0 ? <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">No trip allowances earned this month.</p>
        : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-2 text-start">Employee</th><th className="px-3 py-2 text-end">Days</th><th className="px-3 py-2 text-end">Check-in days</th><th className="px-3 py-2 text-end">Trips</th><th className="px-3 py-2 text-end">Total (EGP)</th><th className="px-3 py-2 text-start">Status</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <Fragment key={r.employee_id}>
                    <tr key={r.employee_id}>
                      <td className="px-3 py-2">
                        <button onClick={() => setOpen(open === r.employee_id ? null : r.employee_id)} className="inline-flex items-center gap-1 font-medium">
                          {open === r.employee_id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{r.employee_name}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-end">{r.days}</td>
                      <td className="px-3 py-2 text-end font-mono">{r.checkin_amount}</td>
                      <td className="px-3 py-2 text-end font-mono">{r.trips_amount}</td>
                      <td className="px-3 py-2 text-end font-mono font-semibold">{r.total}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "approved" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{r.status}</span></td>
                      <td className="px-3 py-2 text-end">
                        {r.saved && r.status === "draft" && <button onClick={() => status.mutate({ ids: [r.employee_id], status: "approved" })} className="text-xs text-primary underline">Approve</button>}
                        {r.status === "approved" && <button onClick={() => status.mutate({ ids: [r.employee_id], status: "draft" })} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"><Undo2 className="h-3 w-3" />Reopen</button>}
                      </td>
                    </tr>
                    {open === r.employee_id && (
                      <tr key={r.employee_id + "-d"}><td colSpan={7} className="bg-muted/30 px-6 py-2 text-xs">
                        {r.details.length === 0 ? "No check-in days — trips only." : r.details.map((d) => <div key={d.date}>{fmtD(d.date)} · {d.location} · {d.rate} EGP</div>)}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-border font-semibold"><td colSpan={4} className="px-3 py-2">Total</td><td className="px-3 py-2 text-end font-mono">{total.toFixed(2)}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
        )}
    </div>
  );
}
