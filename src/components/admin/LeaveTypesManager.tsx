import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { listLeaveTypes, upsertLeaveType, deleteLeaveType } from "@/backend/functions/directory.functions";

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring";
const PAGE_SIZE = 10;

export function LeaveTypesManager() {
  const qc = useQueryClient();
  const list = useServerFn(listLeaveTypes);
  const upsert = useServerFn(upsertLeaveType);
  const del = useServerFn(deleteLeaveType);
  const q = useQuery({ queryKey: ["leave_types"], queryFn: () => list() });
  const m = useMutation({ mutationFn: (r: any) => upsert({ data: r }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave_types"] }); toast.success("Saved"); }, onError: (e: Error) => toast.error(e.message) });
  const mD = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave_types"] }); toast.success("Deleted"); }, onError: (e: Error) => toast.error(e.message) });
  const [draft, setDraft] = useState({ name: "", annual_days: 0, paid: true, active: true, requires_proof: false });
  const [page, setPage] = useState(1);
  const rows: any[] = q.data ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-6">
        <input className={`${inputCls} md:col-span-2`} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className={inputCls} type="number" placeholder="Annual days" value={draft.annual_days} onChange={(e) => setDraft({ ...draft, annual_days: Number(e.target.value) })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.paid} onChange={(e) => setDraft({ ...draft, paid: e.target.checked })} /> Paid</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.requires_proof} onChange={(e) => setDraft({ ...draft, requires_proof: e.target.checked })} /> Requires proof</label>
        <button onClick={() => { if (!draft.name) return toast.error("Name required"); m.mutate(draft); setDraft({ name: "", annual_days: 0, paid: true, active: true, requires_proof: false }); }}
          className="rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">Add</button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>{["Name", "Annual days", "Paid", "Requires proof", "Active", ""].map((c) => <th key={c} className="px-3 py-2 text-start font-semibold">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slice.map((r: any) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.annual_days}</td>
                <td className="px-3 py-2">{r.paid ? "Yes" : "No"}</td>
                <td className="px-3 py-2">
                  <button onClick={() => m.mutate({ ...r, requires_proof: !r.requires_proof })} className={`rounded-full px-2 py-1 text-xs ${r.requires_proof ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                    {r.requires_proof ? "Yes" : "No"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => m.mutate({ ...r, active: !r.active })} className={`rounded-full px-2 py-1 text-xs ${r.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {r.active ? "Yes" : "No"}
                  </button>
                </td>
                <td className="px-3 py-2 text-end">
                  <button onClick={() => mD.mutate(r.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2 text-sm">
          <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span className="text-muted-foreground">Page {safePage} of {pageCount}</span>
          <button disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}