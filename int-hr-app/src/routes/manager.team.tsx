import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getManagerEmployee, getTeam } from "@/lib/manager";

export const Route = createFileRoute("/manager/team")({
  component: TeamPage,
});

function TeamPage() {
  const { t } = useI18n();
  const session = useSession();
  const employees = useStore((s) => s.employees);
  const tasks = useStore((s) => s.tasks);
  const me = getManagerEmployee(session);
  const team = getTeam(employees, me);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">{t("myTeam")}</h1>
        <p className="text-sm text-muted-foreground">{team.length} {t("employees")}</p>
      </div>

      {team.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {t("noTeamMembers")}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {team.map((e) => {
            const open = tasks.filter(
              (tt) => tt.assignees.includes(e.id) && tt.status !== "done" && tt.status !== "cancelled",
            ).length;
            return (
              <li key={e.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.role}</p>
                    <p className="text-xs text-muted-foreground">{e.dept} • {e.branch}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {e.status}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {e.email}</p>
                  <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {e.phone}</p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">{t("tasks")}</span>
                  <span className="font-semibold">{open}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}