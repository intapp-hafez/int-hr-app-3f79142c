import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { listKpis } from "@/backend/functions/kpis.functions";
import { listAllowances } from "@/backend/functions/allowances.functions";
import { listTargetsOvertime } from "@/backend/functions/targets-overtime.functions";
import { listShifts } from "@/backend/functions/shifts.functions";
import {
  listEmployeeAssignments,
  setEmployeeAssignments,
} from "@/backend/functions/employee-assignments.functions";
import { EmployeeWorkingDays } from "@/components/EmployeeWorkingDays";

type Kind = "kpi" | "allowance" | "targets_overtime" | "shift";

const KIND_META: { id: Kind; label: string; describe: (row: any) => string }[] = [
  { id: "kpi", label: "KPIs", describe: (r) => `${r.name} — ${r.target_value ?? ""}${r.unit ?? ""} / ${r.period ?? ""}` },
  { id: "allowance", label: "Allowances", describe: (r) => `${r.name} — ${Number(r.amount ?? 0).toLocaleString()} ${r.currency ?? "EGP"}` },
  { id: "targets_overtime", label: "Targets & Overtime", describe: (r) => `${r.name} — ${r.daily_target_hours ?? 0}h/day · OT ×${r.overtime_rate ?? 1}` },
  { id: "shift", label: "Shifts", describe: (r) => `${r.name} — ${r.start_time ?? ""}→${r.end_time ?? ""}` },
];

export function EmployeeAssignmentsPicker({ employeeId }: { employeeId: string }) {
  const kpiFn = useServerFn(listKpis);
  const allowFn = useServerFn(listAllowances);
  const toFn = useServerFn(listTargetsOvertime);
  const shiftsFn = useServerFn(listShifts);
  const assignFn = useServerFn(listEmployeeAssignments);
  const saveFn = useServerFn(setEmployeeAssignments);

  const { data: kpis = [] } = useQuery({ queryKey: ["kpis"], queryFn: () => kpiFn(), staleTime: 60_000 });
  const { data: allowances = [] } = useQuery({ queryKey: ["allowances"], queryFn: () => allowFn(), staleTime: 60_000 });
  const { data: targetsOt = [] } = useQuery({ queryKey: ["targets_overtime"], queryFn: () => toFn(), staleTime: 60_000 });
  const { data: shifts = [] } = useQuery({ queryKey: ["shifts"], queryFn: () => shiftsFn(), staleTime: 60_000 });
  const { data: current, refetch } = useQuery({
    queryKey: ["employee-assignments", employeeId],
    queryFn: () => assignFn({ data: { employee_id: employeeId } }),
    enabled: !!employeeId,
  });

  const [sel, setSel] = useState<Record<Kind, Set<string>>>({
    kpi: new Set(), allowance: new Set(), targets_overtime: new Set(), shift: new Set(),
  });
  const [busy, setBusy] = useState<Kind | null>(null);

  useEffect(() => {
    if (!current) return;
    setSel({
      kpi: new Set(current.kpi),
      allowance: new Set(current.allowance),
      targets_overtime: new Set(current.targets_overtime),
      shift: new Set(current.shift),
    });
  }, [current]);

  const sources = useMemo<Record<Kind, any[]>>(() => ({
    kpi: kpis, allowance: allowances, targets_overtime: targetsOt, shift: shifts,
  }), [kpis, allowances, targetsOt, shifts]);

  function toggle(kind: Kind, id: string) {
    setSel((prev) => {
      const next = new Set(prev[kind]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [kind]: next };
    });
  }

  async function save(kind: Kind) {
    setBusy(kind);
    try {
      await saveFn({ data: { employee_id: employeeId, kind, ids: Array.from(sel[kind]) } });
      toast.success(`${KIND_META.find((k) => k.id === kind)?.label} saved`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <EmployeeWorkingDays employeeId={employeeId} />
      {KIND_META.map((meta) => {
        const rows = sources[meta.id].filter((r: any) => r.is_active !== false);
        return (
          <section key={meta.id} className="rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="font-display text-sm font-semibold">{meta.label}</h3>
                <p className="text-[11px] text-muted-foreground">{sel[meta.id].size} selected · applies automatically</p>
              </div>
              <button
                onClick={() => save(meta.id)}
                disabled={busy === meta.id}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
              >
                {busy === meta.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
            </header>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">No active {meta.label.toLowerCase()} defined yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r: any) => {
                  const checked = sel[meta.id].has(r.id);
                  return (
                    <li key={r.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
                          checked={checked}
                          onChange={() => toggle(meta.id, r.id)}
                        />
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
  );
}