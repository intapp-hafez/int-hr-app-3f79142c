import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, Search, X, ChevronLeft, ChevronRight, ShieldCheck, AlertTriangle, CheckCircle2, CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { getMyTeam, checkEmployeeAssignment, getTeamPresence, type TeamMember, type AssignmentCheck } from "@/lib/team.functions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmployeeWorkingDays } from "@/components/EmployeeWorkingDays";

export const Route = createFileRoute("/manager/team")({
  component: TeamPage,
});

const todayStr = () => new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 20;

function TeamPage() {
  const { t } = useI18n();
  const tasks = useStore((s) => s.tasks);
  const teamFn = useServerFn(getMyTeam);
  const checkFn = useServerFn(checkEmployeeAssignment);
  const presenceFn = useServerFn(getTeamPresence);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "present" | "absent">("all");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["manager-team", { page, q: debouncedSearch }],
    queryFn: () => teamFn({ data: { page, pageSize: PAGE_SIZE, q: debouncedSearch } }),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
  const team: TeamMember[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const presenceKey = useMemo(() => ["manager-team-presence", { from, to }] as const, [from, to]);
  const { data: presenceData } = useQuery({
    queryKey: presenceKey,
    queryFn: () => presenceFn({ data: { from, to } }),
  });
  const presenceByEmp = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const id of presenceData?.presentIds ?? []) map.set(id, true);
    return map;
  }, [presenceData]);

  // Realtime: refresh presence badges when attendance changes.
  useEffect(() => {
    const channel = supabase
      .channel("manager-team-attendance")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["manager-team-presence"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = useMemo(() => {
    return team.filter((e) => {
      if (status !== "all") {
        const present = presenceByEmp.get(e.id) ?? false;
        if (status === "present" && !present) return false;
        if (status === "absent" && present) return false;
      }
      return true;
    });
  }, [team, status, presenceByEmp]);

  const resetFilters = () => {
    setSearch(""); setStatus("all"); setFrom(todayStr()); setTo(todayStr());
    setPage(1);
  };

  // Assignment diagnostic
  const [checkEmail, setCheckEmail] = useState("emp@hr.com");
  const [checkResult, setCheckResult] = useState<AssignmentCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [openDaysFor, setOpenDaysFor] = useState<string | null>(null);
  const runCheck = async () => {
    setChecking(true); setCheckError(null); setCheckResult(null);
    try {
      const res = await checkFn({ data: { email: checkEmail.trim() } });
      setCheckResult(res);
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">{t("myTeam")}</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} on this page • {total} total {t("employees")}
        </p>
        {error && (
          <p className="mt-1 text-xs text-destructive">{(error as Error).message}</p>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand" />
          <span className="text-sm font-medium">Verify assignment</span>
          <Input
            type="email"
            value={checkEmail}
            onChange={(e) => setCheckEmail(e.target.value)}
            placeholder="employee@email.com"
            className="h-9 max-w-xs"
          />
          <Button size="sm" onClick={runCheck} disabled={checking || !checkEmail.trim()}>
            {checking ? "Checking…" : "Check"}
          </Button>
        </div>
        {checkError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {checkError}
          </div>
        )}
        {checkResult && checkResult.ok && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-success/10 p-2 text-xs text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span><strong>{checkEmail}</strong> is correctly assigned to you (manager_id = your auth.uid()).</span>
          </div>
        )}
        {checkResult && !checkResult.ok && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {checkResult.reason === "not-found" && <>No profile found for <strong>{checkResult.email}</strong>.</>}
              {checkResult.reason === "no-manager" && <><strong>{checkResult.email}</strong> has no manager assigned. Set <code>manager_id</code> to your user id (<code>{checkResult.myId}</code>).</>}
              {checkResult.reason === "different-manager" && <><strong>{checkResult.email}</strong> is assigned to a different manager (<code>{checkResult.managerId}</code>), not you (<code>{checkResult.myId}</code>).</>}
            </span>
          </div>
        )}
      </section>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="ps-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <div className="flex gap-2">
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset filters">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Loading team…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {team.length === 0 ? t("noTeamMembers") : "No team members match the current filters."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((e) => {
            const open = tasks.filter(
              (tt) => tt.assignees.includes(e.id) && tt.status !== "done" && tt.status !== "cancelled",
            ).length;
            const present = presenceByEmp.get(e.id) ?? false;
            return (
              <li key={e.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.role}</p>
                    <p className="text-xs text-muted-foreground">{e.dept} • {e.branch}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {e.status}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${present ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {present ? "Present" : "Absent"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {e.email}</p>
                  <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {e.phone}</p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">{t("tasks")}</span>
                  <span className="font-semibold">{open}</span>
                </div>
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setOpenDaysFor((cur) => (cur === e.id ? null : e.id))}
                  >
                    <CalendarDays className="mr-1 h-4 w-4" />
                    {openDaysFor === e.id ? "Hide working days" : "Working days"}
                  </Button>
                  {openDaysFor === e.id && (
                    <div className="mt-3">
                      <EmployeeWorkingDays employeeId={e.id} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}{isFetching ? " • updating…" : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}