import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Wifi } from "lucide-react";
import { listNetworks, upsertNetwork, deleteNetwork } from "@/backend/functions/networks.functions";
import { NetworkSchema } from "@/backend/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/networks")({
  component: () => <Navigate to="/admin/directory" search={{ tab: "networks" }} replace />,
});

type Form = { id?: string; name: string; ssid: string; bssid: string; branch: string; notes: string; is_active: boolean };
const blank: Form = { name: "", ssid: "", bssid: "", branch: "", notes: "", is_active: true };

export function NetworksManager() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNetworks);
  const upsertFn = useServerFn(upsertNetwork);
  const delFn = useServerFn(deleteNetwork);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "networks"], queryFn: () => listFn() });
  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: { ...f, ssid: f.ssid || null, bssid: f.bssid || null, branch: f.branch || null, notes: f.notes || null } }),
    onSuccess: () => { toast.success(form.id ? "Updated" : "Created"); qc.invalidateQueries({ queryKey: ["admin", "networks"] }); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "networks"] }); setDelId(null); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  function submit() {
    const r = NetworkSchema.safeParse({ ...form, ssid: form.ssid || null, bssid: form.bssid || null, branch: form.branch || null, notes: form.notes || null });
    if (!r.success) { const e: Record<string, string> = {}; r.error.issues.forEach(i => { const k = i.path[0] as string; if (k && !e[k]) e[k] = i.message; }); setErrs(e); return; }
    setErrs({}); m.mutate(form);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Networks</h1>
          <p className="text-sm text-muted-foreground">Allowed Wi-Fi networks (SSID / BSSID) for office check-in.</p>
        </div>
        <Button onClick={() => { setForm(blank); setErrs({}); setOpen(true); }} className="rounded-full"><Plus className="h-4 w-4" /> Add network</Button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">Name</th><th className="px-4 py-3 text-start">SSID</th><th className="px-4 py-3 text-start">BSSID</th><th className="px-4 py-3 text-start">Branch</th><th className="px-4 py-3 text-start">Active</th><th /></tr>
          </thead>
          <tbody>
            {isLoading ? (<tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></td></tr>) :
              rows.length === 0 ? (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No networks yet.</td></tr>) :
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-2"><Wifi className="h-3.5 w-3.5 text-muted-foreground" />{r.name}</span></td>
                  <td className="px-4 py-3 font-mono">{r.ssid ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.bssid ?? "—"}</td>
                  <td className="px-4 py-3">{r.branch ?? "—"}</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => { setForm({ ...r, ssid: r.ssid ?? "", bssid: r.bssid ?? "", branch: r.branch ?? "", notes: r.notes ?? "" }); setErrs({}); setOpen(true); }} className="me-1 grid h-7 w-7 place-items-center rounded-full bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDelId(r.id)} className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Edit network" : "Add network"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={120} />{errs.name && <p className="text-xs text-destructive">{errs.name}</p>}</div>
            <div><Label>SSID</Label><Input value={form.ssid} onChange={e => setForm({ ...form, ssid: e.target.value })} maxLength={64} placeholder="Office Wi-Fi" /></div>
            <div><Label>BSSID (MAC)</Label><Input value={form.bssid} onChange={e => setForm({ ...form, bssid: e.target.value })} maxLength={17} placeholder="AA:BB:CC:DD:EE:FF" />{errs.bssid && <p className="text-xs text-destructive">{errs.bssid}</p>}</div>
            <div><Label>Branch</Label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} maxLength={120} placeholder="Cairo HQ" /></div>
            <div><Label>Notes</Label><Textarea rows={2} maxLength={500} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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
          <AlertDialogHeader><AlertDialogTitle>Delete network?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); if (delId) dm.mutate(delId); }} disabled={dm.isPending}>{dm.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}