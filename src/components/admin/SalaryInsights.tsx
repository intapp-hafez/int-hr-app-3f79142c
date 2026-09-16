import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Search } from "lucide-react";
import { employeeSalaryAiSummary, listSalaryEmployees } from "@/backend/functions/salary-ai.functions";

function money(v: number, currency: string) {
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function SalaryInsights() {
  const listFn = useServerFn(listSalaryEmployees);
  const summaryFn = useServerFn(employeeSalaryAiSummary);
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const { data: employees = [] } = useQuery({
    queryKey: ["admin", "salary-employees"],
    queryFn: () => listFn(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.emp_code ?? "").toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q),
    );
  }, [employees, search]);

  const { data, isFetching, error } = useQuery({
    queryKey: ["admin", "salary-ai", employeeId],
    queryFn: () => summaryFn({ data: { employeeId: employeeId! } }),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees…"
            className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <div className="max-h-[520px] space-y-1 overflow-y-auto">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => setEmployeeId(e.id)}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                employeeId === e.id ? "bg-gradient-brand text-brand-foreground" : "hover:bg-muted/50"
              }`}
            >
              <span className="block font-medium">{e.name}</span>
              <span className="block text-xs opacity-70">{e.emp_code ?? "—"} · {e.department ?? "No department"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {!employeeId ? (
          <p className="text-sm text-muted-foreground">Pick an employee to see their salary summary.</p>
        ) : isFetching ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing salary summary…
          </p>
        ) : error ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {(error as Error).message}
          </p>
        ) : data ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold">{data.employee_name}</h3>
              <p className="text-xs text-muted-foreground">
                {data.emp_code ?? "—"} · {data.department ?? "No department"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Gross", value: data.gross },
                { label: "Net", value: data.net },
                { label: "Allowances", value: data.allowances_total },
                { label: "Insurance (employee)", value: data.employee_insurance },
                { label: "Emergency fund", value: data.emergency_fund },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className="mt-1 text-base font-bold tabular-nums">{money(c.value, data.currency)}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Deduction impact</h4>
              <div className="space-y-2">
                {data.deductions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No deductions apply to this employee.</p>
                )}
                {data.deductions.map((d) => (
                  <div key={d.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{d.label}</span>
                      <span className="font-mono tabular-nums">
                        {money(d.amount, data.currency)} · {d.impact_pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${Math.min(100, d.impact_pct)}%` }} />
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-xs text-muted-foreground">
                  Total deductions {money(data.total_deductions, data.currency)} · take-home {data.take_home_pct}% of gross
                  · employer insurance cost {money(data.employer_insurance, data.currency)}
                </p>
              </div>
            </div>

            {data.allowances.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Allowances</h4>
                <ul className="space-y-1 text-sm">
                  {data.allowances.map((a) => (
                    <li key={a.name} className="flex justify-between">
                      <span>{a.name}{a.taxable ? " · taxable" : ""}</span>
                      <span className="font-mono tabular-nums">{money(a.amount, data.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-brand" /> AI summary
              </h4>
              {data.ai_error ? (
                <p className="text-sm text-muted-foreground">{data.ai_error}</p>
              ) : (
                <p className="whitespace-pre-line text-sm leading-relaxed">{data.ai_summary}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
