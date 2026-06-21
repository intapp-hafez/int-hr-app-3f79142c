import { createFileRoute } from "@tanstack/react-router";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";

export const Route = createFileRoute("/employee/")({
  component: EmployeeDashboard,
});
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        {state === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
        {state === "fail" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
        {state === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />}
        <p className="truncate text-xs font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
