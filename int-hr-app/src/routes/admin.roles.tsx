import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, X, Lock, Search } from "lucide-react";
import { listUsersWithRoles, assignRole, removeRole } from "@/backend/functions/auth.functions";
import {
  getRoleMatrix,
  setRolePermission,
  getUserOverrides,
  setUserOverride,
  PERMISSION_PAGES,
  PERMISSION_ACTIONS,
  type PermissionAction,
} from "@/backend/functions/permissions.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/roles")({ component: RolesPage });

const ALL_ROLES = ["admin", "hr", "manager", "employee", "staff", "user"] as const;
type Role = (typeof ALL_ROLES)[number];
const MANAGED_ROLES = ["hr", "manager", "user"] as const;
type ManagedRole = (typeof MANAGED_ROLES)[number];

const roleColor: Record<Role, string> = {
  admin: "bg-destructive/15 text-destructive",
  hr: "bg-brand/15 text-brand",
  manager: "bg-info/15 text-info",
  employee: "bg-success/15 text-success",
  staff: "bg-warning/20 text-warning-foreground",
  user: "bg-muted text-muted-foreground",
};

function RolesPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Roles & Permissions</h1>
        <p className="text-sm text-muted-foreground">Assign roles and fine-tune what each role or user can do.</p>
      </header>
      <Tabs defaultValue="users" className="space-y-5">
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="role-perms">Role Permissions</TabsTrigger>
          <TabsTrigger value="user-perms">User Overrides</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersAndRoles /></TabsContent>
        <TabsContent value="role-perms"><RolePermissionsTab /></TabsContent>
        <TabsContent value="user-perms"><UserOverridesTab /></TabsContent>
      </Tabs>
      <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4" />
        <p><strong>Admin</strong> always has full access. <strong>Employee</strong> and <strong>Staff</strong> see only their own panel and cannot access admin pages here.</p>
      </div>
    </div>
  );
}

function UsersAndRoles() {
  const qc = useQueryClient();
  const list = useServerFn(listUsersWithRoles);
  const assign = useServerFn(assignRole);
  const remove = useServerFn(removeRole);
  const q = useQuery({ queryKey: ["users-with-roles"], queryFn: () => list() });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const all = (q.data ?? []) as any[];
    if (!s) return all;
    return all.filter((u) =>
      (u.full_name ?? "").toLowerCase().includes(s) ||
      (u.email ?? "").toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const inv = () => qc.invalidateQueries({ queryKey: ["users-with-roles"] });
  const mA = useMutation({
    mutationFn: (v: { user_id: string; role: Role }) => assign({ data: v }),
    onSuccess: () => { inv(); toast.success("Role assigned"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mR = useMutation({
    mutationFn: (v: { user_id: string; role: Role }) => remove({ data: v }),
    onSuccess: () => { inv(); toast.success("Role removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{(q.error as Error).message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email…"
            className="w-full rounded-lg border border-input bg-background py-1.5 ps-7 pe-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
        >
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">User</th>
              <th className="px-4 py-3 text-start font-semibold">Roles</th>
              <th className="px-4 py-3 text-start font-semibold">Assign</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((u: any) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                    {u.roles.map((r: Role) => (
                      <span key={r} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${roleColor[r] ?? "bg-muted"}`}>
                        <Shield className="h-3 w-3" /> {r}
                        {!u.roles.includes("admin") && (
                          <button onClick={() => mR.mutate({ user_id: u.id, role: r })} className="ml-1 opacity-70 hover:opacity-100"><X className="h-3 w-3" /></button>
                        )}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {!u.roles.includes("admin") && (
                    <select
                      defaultValue=""
                      onChange={(e) => { const v = e.target.value as Role; if (v) { mA.mutate({ user_id: u.id, role: v }); e.currentTarget.value = ""; } }}
                      className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm">
                      <option value="">+ add role…</option>
                      {ALL_ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {!q.isLoading && paginated.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Showing {paginated.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{(safePage - 1) * pageSize + paginated.length} of {filtered.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >Previous</button>
          <span className="px-2 text-xs text-muted-foreground">Page {safePage} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >Next</button>
        </div>
      </div>
    </div>
  );
}

function RolePermissionsTab() {
  const qc = useQueryClient();
  const fetchMatrix = useServerFn(getRoleMatrix);
  const setPerm = useServerFn(setRolePermission);
  const q = useQuery({ queryKey: ["role-matrix"], queryFn: () => fetchMatrix() });
  const [role, setRole] = useState<ManagedRole>("hr");

  const map = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of q.data ?? []) m.set(`${(r as any).role}::${(r as any).page}`, r);
    return m;
  }, [q.data]);

  const m = useMutation({
    mutationFn: (v: { role: ManagedRole; page: string; action: PermissionAction; value: boolean }) =>
      setPerm({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-matrix"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {MANAGED_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${role === r ? "bg-brand text-brand-foreground shadow-brand" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >{r}</button>
        ))}
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">Page</th>
              {PERMISSION_ACTIONS.map((a) => (
                <th key={a} className="px-3 py-3 text-center font-semibold capitalize">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PERMISSION_PAGES.map((p) => {
              const row = map.get(`${role}::${p.slug}`) ?? {};
              return (
                <tr key={p.slug}>
                  <td className="px-4 py-3 font-medium">{p.label}</td>
                  {PERMISSION_ACTIONS.map((a) => {
                    const checked = !!row[`can_${a}`];
                    return (
                      <td key={a} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={m.isPending}
                          onChange={(e) => m.mutate({ role, page: p.slug, action: a, value: e.target.checked })}
                          className="h-4 w-4 cursor-pointer accent-[hsl(var(--brand))]"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserOverridesTab() {
  const qc = useQueryClient();
  const list = useServerFn(listUsersWithRoles);
  const fetchOverrides = useServerFn(getUserOverrides);
  const setOverride = useServerFn(setUserOverride);
  const users = useQuery({ queryKey: ["users-with-roles"], queryFn: () => list() });
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (users.data ?? []).filter((u: any) => {
      if (!s) return true;
      return (u.full_name ?? "").toLowerCase().includes(s) || (u.email ?? "").toLowerCase().includes(s);
    }).slice(0, 50);
  }, [users.data, search]);

  const overrides = useQuery({
    queryKey: ["user-overrides", userId],
    queryFn: () => fetchOverrides({ data: { userId: userId! } }),
    enabled: !!userId,
  });

  const overrideMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of overrides.data ?? []) m.set((r as any).page, r);
    return m;
  }, [overrides.data]);

  const m = useMutation({
    mutationFn: (v: { userId: string; page: string; action: PermissionAction; value: boolean | null }) =>
      setOverride({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-overrides", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedUser = (users.data ?? []).find((u: any) => u.id === userId);

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="rounded-3xl border border-border bg-card p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-full rounded-lg border border-input bg-background py-1.5 ps-7 pe-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="max-h-[60vh] space-y-1 overflow-auto">
          {filtered.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No users</p>}
          {filtered.map((u: any) => {
            const managed = (u.roles ?? []).some((r: string) => (MANAGED_ROLES as readonly string[]).includes(r) || r === "admin");
            return (
              <button
                key={u.id}
                onClick={() => setUserId(u.id)}
                className={`w-full rounded-lg px-2 py-2 text-start text-sm ${userId === u.id ? "bg-brand/10 text-brand" : "hover:bg-muted"}`}
              >
                <p className="truncate font-medium">{u.full_name || "—"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                {!managed && <p className="text-[10px] text-warning-foreground">No admin role</p>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-3xl border border-border bg-card">
        {!userId && (
          <div className="p-8 text-center text-sm text-muted-foreground">Select a user to manage overrides.</div>
        )}
        {userId && (
          <div>
            <div className="border-b border-border p-4">
              <p className="font-display text-base font-semibold">{selectedUser?.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground">{selectedUser?.email}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Inherit = use role default. Allow / Deny override the role.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start font-semibold">Page</th>
                    {PERMISSION_ACTIONS.map((a) => (
                      <th key={a} className="px-3 py-3 text-center font-semibold capitalize">{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PERMISSION_PAGES.map((p) => {
                    const row = overrideMap.get(p.slug) ?? {};
                    return (
                      <tr key={p.slug}>
                        <td className="px-4 py-3 font-medium">{p.label}</td>
                        {PERMISSION_ACTIONS.map((a) => {
                          const v = row[`can_${a}`];
                          const cur: "inherit" | "allow" | "deny" =
                            v === null || v === undefined ? "inherit" : v ? "allow" : "deny";
                          return (
                            <td key={a} className="px-3 py-2 text-center">
                              <select
                                value={cur}
                                disabled={m.isPending}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const next = val === "inherit" ? null : val === "allow";
                                  m.mutate({ userId, page: p.slug, action: a, value: next });
                                }}
                                className="rounded-md border border-input bg-background px-1.5 py-1 text-xs"
                              >
                                <option value="inherit">Inherit</option>
                                <option value="allow">Allow</option>
                                <option value="deny">Deny</option>
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}