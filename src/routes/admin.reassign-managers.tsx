import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, UserCog, ScrollText } from "lucide-react";
import {
  listProfilesForAdmin,
  reassignEmployeeManager,
  listManagerAssignmentHistory,
  type AdminProfileRow,
  type ManagerHistoryRow,
} from "@/lib/team.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubTabs } from "@/components/SubTabs";

export const Route = createFileRoute("/admin/reassign-managers")({
  component: ReassignManagersPage,
});

function ReassignManagersPage() {
  const listFn = useServerFn(listProfilesForAdmin);
  const reassignFn = useServerFn(reassignEmployeeManager);
  const historyFn = useServerFn(listManagerAssignmentHistory);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [newManager, setNewManager] = useState<string>("__none__");
  const [reason, setReason] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-profiles", search.trim()],
    queryFn: () => listFn({ data: { q: search.trim() } }),
  });

  const { data: history } = useQuery({
    queryKey: ["manager-history", selected || "all"],
    queryFn: () => historyFn({ data: selected ? { employeeId: selected, limit: 50 } : { limit: 50 } }),
  });

  const profiles: AdminProfileRow[] = data ?? [];
  const selectedRow = useMemo(
    () => profiles.find((p) => p.id === selected),
    [profiles, selected],
  );
  const currentManager = useMemo(
    () => profiles.find((p) => p.id === selectedRow?.managerId),
    [profiles, selectedRow],
  );

  const mutation = useMutation({
    mutationFn: (vars: { employeeId: string; newManagerId: string | null; reason?: string | null }) =>
      reassignFn({ data: vars }),
    onSuccess: (res) => {
      toast.success("Manager reassigned");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["manager-team"] });
      queryClient.invalidateQueries({ queryKey: ["manager-team-all"] });
      queryClient.invalidateQueries({ queryKey: ["manager-history"] });
      setReason("");
      void res;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!selected) return toast.error("Select an employee");
    const nm = newManager === "__none__" ? null : newManager;
    mutation.mutate({ employeeId: selected, newManagerId: nm, reason: reason.trim() || null });
  };

  return (
    <div className="space-y-4">
      <SubTabs items={[
        { to: "/admin/employees", label: "Employees" },
        { to: "/admin/reassign-managers", label: "Reassign Manager" },
      ]} />
      <div className="flex items-center gap-2">
        <UserCog className="h-5 w-5 text-brand" />
        <h1 className="font-display text-xl font-semibold">Reassign manager</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Change which manager an employee reports to. Each change is recorded in the
        audit trail (<code>security_audit_events</code>, kind{" "}
        <code>manager_reassigned</code>).
      </p>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="ps-9"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Employee</span>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Loading…" : "Select employee"} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium">New manager</span>
            <Select value={newManager} onValueChange={setNewManager}>
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No manager —</SelectItem>
                {profiles
                  .filter((p) => p.id !== selected)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName || p.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        {selectedRow && (
          <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
            <p>
              <strong>{selectedRow.fullName || selectedRow.email}</strong> currently
              reports to:{" "}
              <strong>
                {currentManager
                  ? currentManager.fullName || currentManager.email
                  : selectedRow.managerId
                    ? selectedRow.managerId
                    : "— none —"}
              </strong>
            </p>
          </div>
        )}

        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-medium">Reason (optional)</span>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Department restructuring"
            maxLength={500}
          />
        </label>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={submit}
            disabled={!selected || mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Reassign manager"}
          </Button>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-sm font-semibold">
              Change history {selected ? "(this employee)" : "(recent — all employees)"}
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {(history ?? []).length} record{(history ?? []).length === 1 ? "" : "s"}
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-start font-semibold">When</th>
                <th className="px-4 py-2 text-start font-semibold">Employee</th>
                <th className="px-4 py-2 text-start font-semibold">From</th>
                <th className="px-4 py-2 text-start font-semibold">To</th>
                <th className="px-4 py-2 text-start font-semibold">Changed by</th>
                <th className="px-4 py-2 text-start font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No changes recorded yet.</td></tr>
              ) : (history as ManagerHistoryRow[]).map((h) => (
                <tr key={h.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-[11px] tabular-nums whitespace-nowrap">
                    {new Date(h.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{h.employeeName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{h.previousManagerName ?? "— none —"}</td>
                  <td className="px-4 py-2 font-medium">{h.newManagerName ?? "— none —"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{h.changedByName ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{h.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <ScrollText className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Audit entries appear in <code>security_audit_events</code> with the
          previous and new <code>manager_id</code> and the admin who made the change.
        </span>
      </div>
    </div>
  );
}