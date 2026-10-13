import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Banknote } from "lucide-react";
import { listPayrollPayments, approvePayrollPayments, markPayrollPaid, listPaymentHistory } from "@/backend/functions/trip-allowance.functions";

const fmtDate = (iso: string | null) => { if (!iso) return "—"; const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`; };

export function PayrollPaymentsTab({ year, month }: { year: number; month: number }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPayrollPayments);
  const approveFn = useServerFn(approvePayrollPayments);
  const paidFn = useServerFn(markPayrollPaid);
  const histFn = useServerFn(listPaymentHistory);
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const key = ["payroll-payments", year, month];
  const q = useQuery({ queryKey: key, queryFn: () => listFn({ data: { year, month } }) });
  const hist = useQuery({ queryKey: ["payroll-payment-history"], queryFn: () => histFn() });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["payroll-payment-history"] }); };
  const approve = useMutation({ mutationFn: (ids: string[]) => approveFn({ data: { year, month, employee_ids: ids } }), onSuccess: (r) => { toast.success(`Approved ${r.approved}`); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const pay = useMutation({ mutationFn: (ids: string[]) => paidFn({ data: { year, month, employee_ids: ids, method, reference: reference || undefined } }), onSuccess: (r) => { toast.success(`Marked ${r.paid} paid`); setReference(""); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const rows = q.data ?? [];
  const pending = rows.filter((r) => r.status === "pending").map((r) => r.employee_id);
  const approved = rows.filter((r) => r.status === "approved").map((r) => r.employee_id);
  const badge = (s: string) => s === "paid" ? "bg-primary/15 text-primary" : s === "approved" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground";
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Payments · {String(month).padStart(2, "0")}-{year}</h2>
          <p className="text-sm text-muted-foreground">Final-approved trip allowances plus net pay from this month's payroll run. Approve, then mark as paid.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => approve.mutate(pending)} disabled={!pending.length || approve.isPending} className={`${btn} border border-border bg-card`}><CheckCircle2 className="h-4 w-4" /> Approve all ({pending.length})</button>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 rounded-xl border border-input bg-background px-2 text-sm"><option>Bank transfer</option><option>Cash</option><option>Cheque</option><option>Wallet</option></select>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference (optional)" className="h-9 w-40 rounded-xl border border-input bg-background px-3 text-sm" />
          <button onClick={() => pay.mutate(approved)} disabled={!approved.length || pay.isPending} className={`${btn} bg-primary text-primary-foreground`}><Banknote className="h-4 w-4" /> Mark paid ({approved.length})</button>
        </div>
      </div>
      {q.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        : q.error ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{(q.error as Error).message}</p>
        : rows.length === 0 ? <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">Nothing to pay this month yet.</p>
        : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-2 text-start">Employee</th><th className="px-3 py-2 text-end">Trip allowance</th><th className="px-3 py-2 text-start">Allowance step</th><th className="px-3 py-2 text-end">Other earnings</th><th className="px-3 py-2 text-end">Total (EGP)</th><th className="px-3 py-2 text-start">Status</th><th className="px-3 py-2 text-start">Paid</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.employee_id}>
                    <td className="px-3 py-2 font-medium">{r.employee_name}</td>
                    <td className="px-3 py-2 text-end font-mono">{r.trip_allowance}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.trip_status.replace("_", " ")}</td>
                    <td className="px-3 py-2 text-end font-mono">{r.other_earnings}</td>
                    <td className="px-3 py-2 text-end font-mono font-semibold">{r.total}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${badge(r.status)}`}>{r.status}</span></td>
                    <td className="px-3 py-2 text-xs">{r.status === "paid" ? `${fmtDate(r.paid_at)} · ${r.method ?? ""}${r.reference ? ` · ${r.reference}` : ""}` : "—"}</td>
                    <td className="px-3 py-2 text-end">
                      {r.status === "pending" && <button onClick={() => approve.mutate([r.employee_id])} className="text-xs text-primary underline">Approve</button>}
                      {r.status === "approved" && <button onClick={() => pay.mutate([r.employee_id])} className="text-xs text-primary underline">Mark paid</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <div className="space-y-2">
        <h3 className="font-display text-lg font-semibold">Payment history</h3>
        {hist.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : hist.error ? <p className="text-sm text-destructive">{(hist.error as Error).message}</p>
          : !hist.data?.length ? <p className="text-sm text-muted-foreground">No payments yet.</p>
          : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-3 py-2 text-start">Paid on</th><th className="px-3 py-2 text-start">Employee</th><th className="px-3 py-2 text-start">Month</th><th className="px-3 py-2 text-end">Trip</th><th className="px-3 py-2 text-end">Other</th><th className="px-3 py-2 text-end">Total</th><th className="px-3 py-2 text-start">Method</th><th className="px-3 py-2 text-start">Reference</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hist.data.map((h: any) => (
                    <tr key={h.id}><td className="px-3 py-2">{fmtDate(h.paid_at)}</td><td className="px-3 py-2">{h.employee_name}</td><td className="px-3 py-2">{String(h.month).padStart(2, "0")}-{h.year}</td><td className="px-3 py-2 text-end font-mono">{h.trip_allowance}</td><td className="px-3 py-2 text-end font-mono">{h.other_earnings}</td><td className="px-3 py-2 text-end font-mono font-semibold">{h.total}</td><td className="px-3 py-2">{h.method ?? "—"}</td><td className="px-3 py-2">{h.reference ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
