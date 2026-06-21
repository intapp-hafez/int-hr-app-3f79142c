import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { listTargetsOvertime, upsertTargetsOvertime, deleteTargetsOvertime } from "@/backend/functions/targets-overtime.functions";
import { TargetsOvertimeSchema } from "@/backend/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/targets-overtime")({ component: Page });

type Form = { id?: string; name: string; daily_target_hours: number; weekly_target_hours: number; overtime_rate: number; overtime_cap_hours: number; is_active: boolean };
const blank: Form = { name: "", daily_target_hours: 8, weekly_target_hours: 40, overtime_rate: 1.5, overtime_cap_hours: 4, is_active: true };

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTargetsOvertime);
  const upsertFn = useServerFn(upsertTargetsOvertime);
  const delFn = useServerFn(deleteTargetsOvertime);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "targets_overtime"], queryFn: () => listFn() });
  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: f }),
    onSuccess: () => { toast.success(form.id ? "Updated" : "Created"); qc.invalidateQueries({ queryKey: ["admin", "targets_overtime"] }); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "targets_overtime"] }); setDelId(null); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  function submit() {
    const r = TargetsOvertimeSchema.safeParse(form);
    if (!r.success) { const e: Record<string, string> = {}; r.error.issues.forEach(i => { const k = i.path[0] as string; if (k && !e[k]) e[k] = i.message; }); setErrs(e); return; }
    setErrs({}); m.mutate(form);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Targets & Overtime</h1>
          <p className="text-sm text-muted-foreground">Daily/weekly hour targets and overtime rates.</p>
        </div>
        <Button onClick={() => { setForm(blank); setErrs({}); setOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" /> Add policy</Button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">Name</th><th className="px-4 py-3 text-start">Daily</th><th className="px-4 py-3 text-start">Weekly</th><th className="px-4 py-3 text-start">OT rate</th><th className="px-4 py-3 text-start">OT cap</th><th className="px-4 py-3 text-start">Active</th><th /></tr>
          </thead>
          <tbody>
            {isLoading ? (<tr><td colSpan={7} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></td></tr>) :
              rows.length === 0 ? (<tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No policies yet.</td></tr>) :
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono">{r.daily_target_hours}h</td>
                  <td className="px-4 py-3 font-mono">{r.weekly_target_hours}h</td>
                  <td className="px-4 py-3 font-mono">×{r.overtime_rate}</td>
                  <td className="px-4 py-3 font-mono">{r.overtime_cap_hours}h</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => { setForm({ ...r, daily_target_hours: Number(r.daily_target_hours), weekly_target_hours: Number(r.weekly_target_hours), overtime_rate: Number(r.overtime_rate), overtime_cap_hours: Number(r.overtime_cap_hours) }); setErrs({}); setOpen(true); }} className="me-1 grid h-7 w-7 place-items-center rounded-full bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDelId(r.id)} className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Edit policy" : "Add policy"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={120} />{errs.name && <p className="text-xs text-destructive">{errs.name}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Daily target (h)</Label><Input type="number" min={0} step="0.5" value={form.daily_target_hours} onChange={e => setForm({ ...form, daily_target_hours: Number(e.target.value) || 0 })} /></div>
              <div><Label>Weekly target (h)</Label><Input type="number" min={0} step="0.5" value={form.weekly_target_hours} onChange={e => setForm({ ...form, weekly_target_hours: Number(e.target.value) || 0 })} /></div>
              <div><Label>Overtime rate</Label><Input type="number" min={0} step="0.1" value={form.overtime_rate} onChange={e => setForm({ ...form, overtime_rate: Number(e.target.value) || 0 })} /></div>
              <div><Label>Overtime cap (h)</Label><Input type="number" min={0} step="0.5" value={form.overtime_cap_hours} onChange={e => setForm({ ...form, overtime_cap_hours: Number(e.target.value) || 0 })} /></div>
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
          <AlertDialogHeader><AlertDialogTitle>Delete policy?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); if (delId) dm.mutate(delId); }} disabled={dm.isPending}>{dm.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}