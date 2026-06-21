import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { listHolidayTypes, upsertHolidayType, deleteHolidayType } from "@/backend/functions/holiday-types.functions";
import { HolidayTypeSchema } from "@/backend/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/holiday-types")({ component: Page });

type Form = { id?: string; name: string; color: string; is_paid: boolean; affects_attendance: boolean; description: string };
const blank: Form = { name: "", color: "#3B82F6", is_paid: true, affects_attendance: true, description: "" };

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listHolidayTypes);
  const upsertFn = useServerFn(upsertHolidayType);
  const delFn = useServerFn(deleteHolidayType);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "holiday_types"], queryFn: () => listFn() });
  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: { ...f, description: f.description || null } }),
    onSuccess: () => { toast.success(form.id ? "Updated" : "Created"); qc.invalidateQueries({ queryKey: ["admin", "holiday_types"] }); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "holiday_types"] }); setDelId(null); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  function submit() {
    const r = HolidayTypeSchema.safeParse({ ...form, description: form.description || null });
    if (!r.success) { const e: Record<string, string> = {}; r.error.issues.forEach(i => { const k = i.path[0] as string; if (k && !e[k]) e[k] = i.message; }); setErrs(e); return; }
    setErrs({}); m.mutate(form);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Holiday types</h1>
          <p className="text-sm text-muted-foreground">Catalog of holiday categories used across the app.</p>
        </div>
        <Button onClick={() => { setForm(blank); setErrs({}); setOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" /> Add type</Button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">Name</th><th className="px-4 py-3 text-start">Color</th><th className="px-4 py-3 text-start">Paid</th><th className="px-4 py-3 text-start">Affects attendance</th><th className="px-4 py-3 text-start">Description</th><th /></tr>
          </thead>
          <tbody>
            {isLoading ? (<tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></td></tr>) :
              rows.length === 0 ? (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No types yet.</td></tr>) :
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: r.color }} /><span className="font-mono text-xs">{r.color}</span></span></td>
                  <td className="px-4 py-3">{r.is_paid ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{r.affects_attendance ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{r.description ?? "—"}</td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => { setForm({ ...r, description: r.description ?? "" }); setErrs({}); setOpen(true); }} className="me-1 grid h-7 w-7 place-items-center rounded-full bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDelId(r.id)} className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Edit type" : "Add type"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={120} />{errs.name && <p className="text-xs text-destructive">{errs.name}</p>}</div>
            <div><Label>Color</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-10 w-16 p-1" />
                <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} maxLength={7} />
              </div>
              {errs.color && <p className="text-xs text-destructive">{errs.color}</p>}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Paid</Label><Switch checked={form.is_paid} onCheckedChange={v => setForm({ ...form, is_paid: v })} /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Affects attendance</Label><Switch checked={form.affects_attendance} onCheckedChange={v => setForm({ ...form, affects_attendance: v })} /></div>
            <div><Label>Description</Label><Textarea rows={2} maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={m.isPending}>{m.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {form.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!delId} onOpenChange={o => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete type?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); if (delId) dm.mutate(delId); }} disabled={dm.isPending}>{dm.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}