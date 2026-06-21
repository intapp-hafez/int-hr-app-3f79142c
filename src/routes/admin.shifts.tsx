import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { listShifts, upsertShift, deleteShift } from "@/backend/functions/shifts.functions";
import { ShiftSchema } from "@/backend/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/shifts")({ component: Page });

type Form = { id?: string; name: string; start_time: string; end_time: string; grace_minutes: number; is_overnight: boolean; is_active: boolean };
const blank: Form = { name: "", start_time: "09:00", end_time: "17:00", grace_minutes: 0, is_overnight: false, is_active: true };

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listShifts);
  const upsertFn = useServerFn(upsertShift);
  const delFn = useServerFn(deleteShift);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "shifts"], queryFn: () => listFn() });
  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: f }),
    onSuccess: () => { toast.success(form.id ? "Updated" : "Created"); qc.invalidateQueries({ queryKey: ["admin", "shifts"] }); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "shifts"] }); setDelId(null); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  function submit() {
    const r = ShiftSchema.safeParse(form);
    if (!r.success) { const e: Record<string, string> = {}; r.error.issues.forEach(i => { const k = i.path[0] as string; if (k && !e[k]) e[k] = i.message; }); setErrs(e); return; }
    setErrs({}); m.mutate(form);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Shifts</h1>
          <p className="text-sm text-muted-foreground">Work shift definitions with grace time.</p>
        </div>
        <Button onClick={() => { setForm(blank); setErrs({}); setOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" /> Add shift</Button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">Name</th><th className="px-4 py-3 text-start">Start</th><th className="px-4 py-3 text-start">End</th><th className="px-4 py-3 text-start">Grace</th><th className="px-4 py-3 text-start">Overnight</th><th className="px-4 py-3 text-start">Active</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {isLoading ? (<tr><td colSpan={7} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></td></tr>) :
              rows.length === 0 ? (<tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No shifts yet.</td></tr>) :
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono">{r.start_time}</td>
                  <td className="px-4 py-3 font-mono">{r.end_time}</td>
                  <td className="px-4 py-3 font-mono">{r.grace_minutes}m</td>
                  <td className="px-4 py-3">{r.is_overnight ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => { setForm({ ...r }); setErrs({}); setOpen(true); }} className="me-1 grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDelId(r.id)} className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Edit shift" : "Add shift"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={120} />{errs.name && <p className="text-xs text-destructive">{errs.name}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start time</Label><Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>End time</Label><Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <div><Label>Grace (minutes)</Label><Input type="number" min={0} max={240} value={form.grace_minutes} onChange={e => setForm({ ...form, grace_minutes: Number(e.target.value) || 0 })} /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Overnight shift</Label><Switch checked={form.is_overnight} onCheckedChange={v => setForm({ ...form, is_overnight: v })} /></div>
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
          <AlertDialogHeader><AlertDialogTitle>Delete shift?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); if (delId) dm.mutate(delId); }} disabled={dm.isPending}>{dm.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}