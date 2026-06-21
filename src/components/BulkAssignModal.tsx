import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Loader2, Layers } from "lucide-react";
import { listKpis } from "@/backend/functions/kpis.functions";
import { listAllowances } from "@/backend/functions/allowances.functions";
import { listTargetsOvertime } from "@/backend/functions/targets-overtime.functions";
import { listShifts } from "@/backend/functions/shifts.functions";
import { bulkAssignToEmployees } from "@/backend/functions/employee-assignments.functions";

type Kind = "kpi" | "allowance" | "targets_overtime" | "shift";

const KIND_META: { id: Kind; label: string; describe: (row: any) => string }[] = [
  { id: "kpi", label: "KPIs", describe: (r) => `${r.name} — ${r.target_value ?? ""}${r.unit ?? ""} / ${r.period ?? ""}` },
  { id: "allowance", label: "Allowances", describe: (r) => `${r.name} — ${Number(r.amount ?? 0).toLocaleString()} ${r.currency ?? "EGP"}` },
  { id: "targets_overtime", label: "Targets & Overtime", describe: (r) => `${r.name} — ${r.daily_target_hours ?? 0}h/day · OT ×${r.overtime_rate ?? 1}` },
  { id: "shift", label: "Shifts", describe: (r) => `${r.name} — ${r.start_time ?? ""}→${r.end_time ?? ""}` },
];

export function BulkAssignModal({
  employeeIds,
  onClose,
  onDone,
}: {
  employeeIds: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const kpiFn = useServerFn(listKpis);
  const allowFn = useServerFn(listAllowances);
  const toFn = useServerFn(listTargetsOvertime);
  const shiftsFn = useServerFn(listShifts);
  const bulkFn = useServerFn(bulkAssignToEmployees);

  const { data: kpis = [] } = useQuery({ queryKey: ["kpis"], queryFn: () => kpiFn(), staleTime: 60_000 });
  const { data: allowances = [] } = useQuery({ queryKey: ["allowances"], queryFn: () => allowFn(), staleTime: 60_000 });
  const { data: targetsOt = [] } = useQuery({ queryKey: ["targets_overtime"], queryFn: () => toFn(), staleTime: 60_000 });
  const { data: shifts = [] } = useQuery({ queryKey: ["shifts"], queryFn: () => shiftsFn(), staleTime: 60_000 });

  const sources = useMemo<Record<Kind, any[]>>(
    () => ({ kpi: kpis, allowance: allowances, targets_overtime: targetsOt, shift: shifts }),
    [kpis, allowances, targetsOt, shifts],
  );

  const [sel, setSel] = useState<Record<Kind, Set<string>>>({
    kpi: new Set(), allowance: new Set(), targets_overtime: new Set(), shift: new Set(),
  });
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [busy, setBusy] = useState(false);

  const totalSelected = sel.kpi.size + sel.allowance.size + sel.targets_overtime.size + sel.shift.size;

  function toggle(kind: Kind, id: string) {
    setSel((prev) => {
      const next = new Set(prev[kind]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [kind]: next };
    });
  }

  async function apply() {
    if (mode === "add" && totalSelected === 0) {
      toast.error("Select at least one item to assign");
      return;
    }
    if (mode === "replace") {
      const yes = confirm(
        `Replace assignments for ${employeeIds.length} employee(s)? Existing items in the touched categories will be removed.`,
      );
      if (!yes) return;
    }
    setBusy(true);
    try {
      const res = await bulkFn({
        data: {
          employee_ids: employeeIds,
          mode,
          assignments: {
            kpi: Array.from(sel.kpi),
            allowance: Array.from(sel.allowance),
            targets_overtime: Array.from(sel.targets_overtime),
            shift: Array.from(sel.shift),
          },
        },
      });
      toast.success(`Applied to ${employeeIds.length} employee(s)`, {
        description: `${res.inserted} link(s) added${res.cleared ? `, ${res.cleared} cleared` : ""}.`,
      });
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk assign failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/40 p-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-auto w-full max-w-3xl rounded-3xl bg-background p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand"><Layers className="h-4 w-4" /></span>
            <div>
              <h2 className="font-display text-lg font-semibold">Bulk assign</h2>
              <p className="text-xs text-muted-foreground">{employeeIds.length} employee(s) selected</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2 text-xs">
          <label className={`inline-flex flex-1 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 ${mode === "add" ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:bg-muted"}`}>
            <input type="radio" className="sr-only" checked={mode === "add"} onChange={() => setMode("add")} />
            <span className="font-semibold">Add</span>
            <span className="opacity-80">— keep existing, append selected</span>
          </label>
          <label className={`inline-flex flex-1 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 ${mode === "replace" ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:bg-muted"}`}>
            <input type="radio" className="sr-only" checked={mode === "replace"} onChange={() => setMode("replace")} />
            <span className="font-semibold">Replace</span>
            <span className="opacity-80">— clear &amp; set only the selected</span>
          </label>
        </div>

        <div className="grid max-h-[55vh] gap-3 overflow-y-auto md:grid-cols-2">
          {KIND_META.map((meta) => {
            const rows = sources[meta.id].filter((r: any) => r.is_active !== false);
            return (
              <section key={meta.id} className="rounded-2xl border border-border bg-card">
                <header className="flex items-center justify-between border-b border-border px-3 py-2">
                  <h3 className="text-sm font-semibold">{meta.label}</h3>
                  <span className="text-[11px] text-muted-foreground">{sel[meta.id].size} selected</span>
                </header>
                {rows.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">No active items.</p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto divide-y divide-border">
                    {rows.map((r: any) => {
                      const checked = sel[meta.id].has(r.id);
                      return (
                        <li key={r.id}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50">
                            <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={checked} onChange={() => toggle(meta.id, r.id)} />
                            <span className="text-foreground">{meta.describe(r)}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold">Cancel</button>
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}