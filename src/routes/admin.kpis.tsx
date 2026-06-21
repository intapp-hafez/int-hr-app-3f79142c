import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { listKpis, upsertKpi, deleteKpi } from "@/backend/functions/kpis.functions";
import { KpiSchema } from "@/backend/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/kpis")({ component: Page });

type Form = { id?: string; name: string; metric: string; target_value: number; unit: string; period: "daily"|"weekly"|"monthly"|"quarterly"|"yearly"; weight: number; is_active: boolean };
const blank: Form = { name: "", metric: "", target_value: 0, unit: "", period: "monthly", weight: 1, is_active: true };

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listKpis);
  const upsertFn = useServerFn(upsertKpi);
  const delFn = useServerFn(deleteKpi);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "kpis"], queryFn: () => listFn() });
  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: { ...f, unit: f.unit || null } }),
    onSuccess: () => { toast.success(form.id ? "Updated" : "Created"); qc.invalidateQueries({ queryKey: ["admin", "kpis"] }); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "kpis"] }); setDelId(null); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  function submit() {
    const r = KpiSchema.safeParse({ ...form, unit: form.unit || null });
    if (!r.success) { const e: Record<string, string> = {}; r.error.issues.forEach(i => { const k = i.path[0] as string; if (k && !e[k]) e[k] = i.message; }); setErrs(e); return; }
    setErrs({}); m.mutate(form);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">KPIs</h1>
          <p className="text-sm text-muted-foreground">Performance indicators with targets and weights.</p>
        </div>
        <Button onClick={() => { setForm(blank); setErrs({}); setOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" /> Add KPI</Button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">Name</th><th className="px-4 py-3 text-start">Metric</th><th className="px-4 py-3 text-start">Target</th><th className="px-4 py-3 text-start">Unit</th><th className="px-4 py-3 text-start">Period</th><th className="px-4 py-3 text-start">Weight</th><th className="px-4 py-3 text-start">Active</th><th /></tr>
          </thead>
          <tbody>
            {isLoading ? (<tr><td colSpan={8} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></td></tr>) :
              rows.length === 0 ? (<tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No KPIs yet.</td></tr>) :
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.metric}</td>
                  <td className="px-4 py-3 font-mono">{r.target_value}</td>
                  <td className="px-4 py-3">{r.unit ?? "—"}</td>
                  <td className="px-4 py-3">{r.period}</td>
                  <td className="px-4 py-3 font-mono">{r.weight}</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => { setForm({ ...r, target_value: Number(r.target_value), weight: Number(r.weight), unit: r.unit ?? "" }); setErrs({}); setOpen(true); }} className="me-1 grid h-7 w-7 place-items-center rounded-full bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDelId(r.id)} className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Edit KPI" : "Add KPI"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={120} />{errs.name && <p className="text-xs text-destructive">{errs.name}</p>}</div>
            <div><Label>Metric</Label><Input value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })} maxLength={200} placeholder="e.g. tasks_completed" />{errs.metric && <p className="text-xs text-destructive">{errs.metric}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Target</Label><Input type="number" min={0} step="0.01" value={form.target_value} onChange={e => setForm({ ...form, target_value: Number(e.target.value) || 0 })} /></div>
              <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} maxLength={40} placeholder="%, calls, hours" /></div>
              <div><Label>Period</Label>
                <Select value={form.period} onValueChange={(v: any) => setForm({ ...form, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Weight</Label><Input type="number" min={0} step="0.1" value={form.weight} onChange={e => setForm({ ...form, weight: Number(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={m.isPending}>{m.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {form.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!delId} onOpenChange={o => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete KPI?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); if (delId) dm.mutate(delId); }} disabled={dm.isPending}>{dm.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}