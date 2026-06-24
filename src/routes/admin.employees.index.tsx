import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Filter, X, ChevronRight, Upload, FileText, ArrowUp, ArrowDown, ArrowUpDown, Pencil, Trash2, Eye, AlertCircle, AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { SalaryPreview } from "@/components/SalaryPreview";
import { computeSalaryPair } from "@/lib/salary-calc";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useStore, getState, addEmployee, type Employee } from "@/lib/store";
import { BulkAssignModal } from "@/components/BulkAssignModal";
import { Layers } from "lucide-react";
import { locations } from "@/lib/mock-data";
import { formatEgPhone, isValidEgPhone } from "@/lib/phone";
import { validateAndStoreDocument } from "@/lib/documents.functions";
import { validateEmployeesBatch } from "@/lib/employees.functions";
import { getMe } from "@/backend/functions/auth.functions";
import {
  listEmployeesAdmin,
  updateEmployeeAdmin,
  bulkSetEmployeeStatus,
  importEmployeesAdmin,
  deleteEmployeeAdmin,
  bulkDeleteEmployeesAdmin,
  bulkAssignEmployeeRole,
  listCitiesAndDistricts,
  sendEmployeeWelcomeEmail,
  type AdminEmployeeRow,
  type ListEmployeesResult,
} from "@/backend/functions/employees.functions";
import { useRef } from "react";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { SubTabs } from "@/components/SubTabs";



export const Route = createFileRoute("/admin/employees/")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "Active" | "Inactive">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<"full_name" | "email" | "created_at" | "status" | "contract_end_date" | "contract_remaining">("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEmployeeRow | null>(null);

  const listFn = useServerFn(listEmployeesAdmin);
  const citiesFn = useServerFn(listCitiesAndDistricts);
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({
    queryKey: ["me", "roles"],
    queryFn: () => getMeFn(),
    staleTime: 60_000,
  });
  const isAdmin = (me?.roles ?? []).includes("admin");
  const queryKey = ["admin", "employees", "list", { q, deptFilter, posFilter, roleFilter, statusFilter, page, pageSize, sort, dir }] as const;
  const { data, isLoading, isFetching } = useQuery<ListEmployeesResult>({
    queryKey,
    queryFn: () => listFn({
      data: {
        q, departmentId: deptFilter, positionId: posFilter, role: roleFilter,
        status: statusFilter, page, pageSize, sort, dir,
      },
    }),
    placeholderData: (prev) => prev,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const departments = data?.departments ?? [];
  const positions = data?.positions ?? [];
  const { data: geo } = useQuery({
    queryKey: ["admin", "cities-districts"],
    queryFn: () => citiesFn(),
    staleTime: 5 * 60_000,
  });
  const cities = geo?.cities ?? [];
  const districts = geo?.districts ?? [];
  const allRoles = data?.roles ?? [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const resetPage = () => setPage(1);
  function toggleSort(col: typeof sort) {
    if (sort === col) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(col); setDir("asc"); }
    resetPage();
  }

  const bulkFn = useServerFn(bulkSetEmployeeStatus);
  const bulkMut = useMutation({
    mutationFn: (status: "Active" | "Inactive") => bulkFn({ data: { ids: Array.from(selected), status } }),
    onSuccess: (res, status) => {
      toast.success(`${res.count} employees set ${status}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin", "employees", "list"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk update failed"),
  });

  const deleteFn = useServerFn(deleteEmployeeAdmin);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Employee deleted");
      qc.invalidateQueries({ queryKey: ["admin", "employees", "list"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const bulkDeleteFn = useServerFn(bulkDeleteEmployeesAdmin);
  const bulkDeleteMut = useMutation({
    mutationFn: () => bulkDeleteFn({ data: { ids: Array.from(selected) } }),
    onSuccess: (res) => {
      toast.success(`${res.count} employees deleted`);
      if (res.errors?.length) toast.error(res.errors[0]);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin", "employees", "list"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk delete failed"),
  });

  const bulkRoleFn = useServerFn(bulkAssignEmployeeRole);
  const bulkRoleMut = useMutation({
    mutationFn: (role: "admin" | "hr" | "manager" | "employee") =>
      bulkRoleFn({ data: { ids: Array.from(selected), role } }),
    onSuccess: (res, role) => {
      toast.success(`${res.count} employees assigned ${role}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin", "employees", "list"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Assign role failed"),
  });

  async function exportSelected() {
    const XLSX = await import("xlsx");
    const sel = rows.filter((r) => selected.has(r.id));
    if (sel.length === 0) { toast.error("No rows selected"); return; }
    const data = sel.map((r) => ({
      id: r.id, name: r.full_name, email: r.email, phone: r.phone,
      department: r.department, position: r.position, city: r.city, district: r.district,
      status: r.status, roles: r.roles.join("|"), created_at: r.created_at,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, `employees_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <SubTabs items={[
        { to: "/admin/employees", label: "Employees" },
        { to: "/admin/reassign-managers", label: "Reassign Manager" },
      ]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("employees")}</h1>
          <p className="text-sm text-muted-foreground">{total} · {locations.length} {t("branch")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportExcelInline />
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand"
          >
            <Plus className="h-4 w-4" /> {t("addEmployee")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); resetPage(); }}
            className="w-full rounded-full border border-input bg-card py-2.5 ps-9 pe-3 text-sm"
            placeholder={t("search")}
          />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <Filter className="h-4 w-4" /> {t("filters")}
        </div>
        <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); resetPage(); }}
          className="rounded-full border border-input bg-card px-3 py-2 text-sm">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={posFilter} onChange={(e) => { setPosFilter(e.target.value); resetPage(); }}
          className="rounded-full border border-input bg-card px-3 py-2 text-sm">
          <option value="">All positions</option>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); resetPage(); }}
          className="rounded-full border border-input bg-card px-3 py-2 text-sm">
          <option value="">All roles</option>
          {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); resetPage(); }}
          className="rounded-full border border-input bg-card px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        {(deptFilter || posFilter || roleFilter || statusFilter || q) && (
          <button
            onClick={() => { setQ(""); setDeptFilter(""); setPosFilter(""); setRoleFilter(""); setStatusFilter(""); resetPage(); }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs"
          ><X className="h-3 w-3" /> Clear</button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand/5 px-4 py-2 text-sm">
          <span className="font-semibold">{selected.size} selected</span>
          <div className="ms-auto flex flex-wrap gap-2">
            <button onClick={() => bulkMut.mutate("Active")} disabled={bulkMut.isPending}
              className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20">Activate</button>
            <button onClick={() => bulkMut.mutate("Inactive")} disabled={bulkMut.isPending}
              className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/20">Deactivate</button>
            <button onClick={exportSelected}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button
              onClick={() => setBulkAssignOpen(true)}
              disabled={!isAdmin}
              title={isAdmin ? "Assign KPIs, Allowances, Targets & Overtime, Shifts" : "Admin role required"}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Layers className="h-3.5 w-3.5" /> Assign…
            </button>
            <select
              onChange={(ev) => {
                const role = ev.target.value as "admin" | "hr" | "manager" | "employee" | "";
                if (!role) return;
                if (confirm(`Assign role "${role}" to ${selected.size} employee(s)?`)) {
                  bulkRoleMut.mutate(role);
                }
                ev.target.value = "";
              }}
              disabled={bulkRoleMut.isPending || !isAdmin}
              title={isAdmin ? "Assign a role to all selected" : "Admin role required"}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              defaultValue=""
            >
              <option value="" disabled>Assign role…</option>
              <option value="admin">admin</option>
              <option value="hr">hr</option>
              <option value="manager">manager</option>
              <option value="employee">employee</option>
            </select>
            <button
              onClick={() => {
                if (confirm(`Delete ${selected.size} employee(s)? This cannot be undone.`)) bulkDeleteMut.mutate();
              }}
              disabled={bulkDeleteMut.isPending || !isAdmin}
              title={isAdmin ? undefined : "Admin role required"}
              className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="rounded-full px-3 py-1.5 text-xs">Clear</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label="Select all" />
              </th>
              <SortableTh label={t("name")} col="full_name" sort={sort} dir={dir} onSort={toggleSort} />
              <Th>ID</Th>
              
              <Th>{t("position")}</Th>
              <Th>{t("phone")}</Th>
              <SortableTh label="Status" col="status" sort={sort} dir={dir} onSort={toggleSort} />
              <SortableTh label="Contract" col="contract_remaining" sort={sort} dir={dir} onSort={toggleSort} />
              <SortableTh label="Contract End" col="contract_end_date" sort={sort} dir={dir} onSort={toggleSort} />
              <Th>Roles</Th>
              <Th>{t("actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.id}
                onClick={() => navigate({ to: "/admin/employees/$id", params: { id: e.id } })}
                className="group cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-muted/40"
              >
                <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                  <input type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={(ev) => {
                      const next = new Set(selected);
                      if (ev.target.checked) next.add(e.id); else next.delete(e.id);
                      setSelected(next);
                    }}
                    aria-label="Select row" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar id={e.id} name={e.full_name ?? e.email ?? "?"} url={e.avatar_url} className="h-8 w-8" />
                    <div>
                      <p className="font-medium">{e.full_name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{e.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {e.emp_code ? (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        navigator.clipboard?.writeText(e.emp_code!).then(
                          () => toast.success("ID copied"),
                          () => toast.error("Copy failed"),
                        );
                      }}
                      title={`${e.emp_code} · ${e.id}`}
                      className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-semibold text-foreground hover:bg-muted/70"
                    >
                      {e.emp_code}
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                </td>
                
                <Td>{e.position ?? "—"}</Td>
                <Td mono>{e.phone ?? "—"}</Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                    {e.status}
                  </span>
                </Td>
                <Td>
                  <ContractDaysBadge endDate={e.contract_end_date} cancelled={e.contract_cancelled} />
                </Td>
                <Td mono>{e.contract_end_date ?? "—"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {e.roles.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                    {e.roles.map((r) => {
                      const rc: Record<string, string> = {
                        admin:    "bg-red-100 text-red-700 ring-1 ring-red-300",
                        hr:       "bg-purple-100 text-purple-700 ring-1 ring-purple-300",
                        manager:  "bg-blue-100 text-blue-700 ring-1 ring-blue-300",
                        employee: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
                        staff:    "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
                        user:     "bg-slate-100 text-slate-600 ring-1 ring-slate-300",
                      };
                      return (
                        <span key={r} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${rc[r] ?? "bg-muted text-muted-foreground"}`}>{r}</span>
                      );
                    })}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                    <button
                      onClick={() => setEditing(e)}
                      title="Edit"
                      className="inline-flex items-center rounded-full border border-border bg-card p-1.5 text-xs font-semibold hover:bg-muted"
                    ><Pencil className="h-3.5 w-3.5" /></button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${e.full_name ?? e.email}? This cannot be undone.`)) deleteMut.mutate(e.id);
                      }}
                      disabled={deleteMut.isPending || !isAdmin}
                      title={isAdmin ? "Delete" : "Admin role required"}
                      className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 p-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-destructive/10"
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                    <Link
                      to="/admin/employees/$id"
                      params={{ id: e.id }}
                      title="View"
                      className="inline-flex items-center rounded-full p-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">{isLoading ? "Loading…" : "—"}</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
              className="rounded-md border border-input bg-card px-2 py-1">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {isFetching && <span className="text-muted-foreground/70">Loading…</span>}
          </div>
          <div className="flex items-center gap-2">
            <span>Page {page} of {totalPages} · {total} total</span>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
              className="rounded-md border border-border bg-card px-2 py-1 disabled:opacity-50">Prev</button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              className="rounded-md border border-border bg-card px-2 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {open && <AddEmployeeModal departments={departments} positions={positions} cities={cities} districts={districts} managers={geo?.managers ?? []} onClose={() => setOpen(false)} />}
      {bulkAssignOpen && (
        <BulkAssignModal
          employeeIds={Array.from(selected).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))}
          onClose={() => setBulkAssignOpen(false)}
        />
      )}
      {editing && (
        <EditEmployeeDrawer
          row={editing}
          departments={departments}
          positions={positions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin", "employees", "list"] });
          }}
        />
      )}
    </div>
  );
}

function SortableTh({ label, col, sort, dir, onSort }: {
  label: string; col: "full_name" | "email" | "created_at" | "status" | "contract_end_date" | "contract_remaining";
  sort: string; dir: "asc" | "desc"; onSort: (c: any) => void;
}) {
  const active = sort === col;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-4 py-3 text-start font-medium">
      <button onClick={() => onSort(col)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground">
        {label} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function EditEmployeeDrawer({
  row, departments, positions, onClose, onSaved,
}: {
  row: AdminEmployeeRow;
  departments: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [departmentId, setDepartmentId] = useState<string>(row.department_id ?? "");
  const [positionId, setPositionId] = useState<string>(row.position_id ?? "");
  const [status, setStatus] = useState<"Active" | "Inactive">(row.status === "Inactive" ? "Inactive" : "Active");
  const [avatarUrl, setAvatarUrl] = useState<string>(row.avatar_url ?? "");
  const [busy, setBusy] = useState(false);
  const updateFn = useServerFn(updateEmployeeAdmin);

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.currentTarget.value = "";
    if (!f) return;
    if (!["image/png","image/jpeg","image/jpg","image/webp"].includes(f.type)) {
      toast.error("Only WEBP, PNG or JPEG allowed"); return;
    }
    if (f.size > 500 * 1024) { toast.error("Avatar must be 500 KB or less"); return; }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
    setAvatarUrl(dataUrl);
  }

  async function save() {
    setBusy(true);
    try {
      await updateFn({ data: {
        id: row.id,
        department_id: departmentId || null,
        position_id: positionId || null,
        status,
        avatar_url: avatarUrl || null,
      }});
      toast.success("Employee updated");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Edit employee</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 flex items-center gap-3">
          <EmployeeAvatar id={row.id} name={row.full_name ?? row.email ?? "?"} url={avatarUrl} className="h-14 w-14" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{row.full_name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Avatar URL</span>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://… or upload"
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm" />
            <div className="mt-2 flex gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                <Upload className="h-3.5 w-3.5" /> Upload
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarFile} />
              </label>
              {avatarUrl && (
                <button onClick={() => setAvatarUrl("")} className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs">Remove</button>
              )}
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Department</span>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm">
              <option value="">—</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Position</span>
            <select value={positionId} onChange={(e) => setPositionId(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm">
              <option value="">—</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-card px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={busy}
            className="rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Egyptian phone validation/formatting lives in @/lib/phone

type CityOpt = { id: string; name_en: string };
type DistrictOpt = { id: string; city_id: string; name_en: string };

function AddEmployeeModal({ departments, positions, cities, districts, managers, onClose }: { departments: { id: string; name: string }[]; positions: { id: string; name: string }[]; cities: CityOpt[]; districts: DistrictOpt[]; managers: { id: string; name: string }[]; onClose: () => void }) {
  const { t } = useI18n();
  const validateBatch = useServerFn(validateEmployeesBatch);
  const sendWelcome = useServerFn(sendEmployeeWelcomeEmail);
  const setupIncomplete = departments.length === 0 || positions.length === 0;
  const [form, setForm] = useState<Omit<Employee, "id"> & ExtraHr>({
    name: "",
    email: "",
    phone: "",
    dept: departments[0]?.name ?? "",
    role: "",
    status: "Active",
    branch: locations[0]?.name ?? "Cairo HQ",
    salary: 0,
    allowance: 0,
    target: 20,
    targetDuration: "Monthly",
    password: "",
    managerId: "",
    gender: "",
    country: "Egypt",
    city: "",
    district: "",
    street: "",
    building: "",
    flat: "",
    nationalId: "",
    nationalIdExpiry: "",
    position: positions[0]?.name ?? "",
    contractType: "FullTime",
    notes: "",
    manager: "",
    salaryMode: "gross",
    salaryGross: 0,
    salaryNet: 0,
    empCode: "",
    idIssueDate: "",
    idCardAddress: "",
    avatarUrl: "",
    personalPhone: "",
  });
  const [docs, setDocs] = useState<Record<string, StoredDoc | undefined>>({});
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractCancelled, setContractCancelled] = useState(false);
  const [allowPastExpiry, setAllowPastExpiry] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (setupIncomplete) return setErr(t("employeeSetupIncomplete" as any) || "Add at least one Department and Position before creating employees.");
    if (!form.name.trim() || form.name.trim().length < 2) return setErr("Name is required (min 2 chars)");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErr("Valid email required");
    if (!isValidEgPhone(form.phone)) return setErr(t("phoneInvalid"));
    if (!form.password || form.password.length < 6) return setErr("Password must be at least 6 characters");
    if (!form.salary || form.salary <= 0) return setErr("Salary is required");
    if (form.target <= 0) return setErr("Target value must be > 0");
    if (!(VALID_SALARY_MODES as readonly string[]).includes(form.salaryMode)) return setErr("Invalid salary mode");
    if (!(VALID_CONTRACT_TYPES as readonly string[]).includes(form.contractType)) return setErr("Invalid contract type");
    if (!form.dept.trim()) return setErr("Department is required");
    if (form.manager && !managers.some((emp) => emp.id === form.manager)) return setErr("Invalid manager");
    const expCheck = validateIdExpiry(form.nationalId, form.nationalIdExpiry);
    if (expCheck !== "ok") return setErr(t(expCheck as any));
    void (async () => {
      try {
        const res = await validateBatch({
          data: {
            employees: [{
              name: form.name, email: form.email, dept: form.dept,
              contractType: form.contractType, salaryMode: form.salaryMode,
              targetDuration: form.targetDuration, manager: form.manager,
              nationalId: form.nationalId, nationalIdExpiry: form.nationalIdExpiry,
            }],
            managerIds: managers.map((emp) => emp.id),
          },
        });
        if (!res.ok) {
          const r = res.results[0];
          const msg = r?.error ? (t(r.error as any) || r.error) : t("serverValidationFailed");
          setErr(msg);
          return;
        }
        const sal = Number(form.salary) || 0;
        const salaryGross = form.salaryMode === "gross" ? sal : Math.round(sal / 0.9);
        const salaryNet = form.salaryMode === "net" ? sal : Math.round(sal * 0.9);
        const id = addEmployee({
          ...form,
          id: form.empCode?.trim() || undefined,
          phone: formatEgPhone(form.phone),
          salaryGross,
          salaryNet,
          documents: docs,
        } as any);
        toast.success(`Employee ${id} added`, { description: form.name });
        // Fire-and-forget welcome email with credentials + login URL.
        void (async () => {
          try {
            const loginUrl = `${window.location.origin}/auth`;
            const res = await sendWelcome({
              data: {
                to: form.email.trim().toLowerCase(),
                employeeName: form.name.trim(),
                username: form.email.trim().toLowerCase(),
                password: form.password,
                loginUrl,
                appName: document.title || "HR Portal",
              },
            });
            if (res?.ok) toast.success("Welcome email sent", { description: form.email });
            else toast.error("Welcome email failed", { description: res?.error || "SMTP not configured" });
          } catch (err: any) {
            toast.error("Welcome email failed", { description: err?.message || "send error" });
          }
        })();
        onClose();
      } catch {
        setErr(t("serverValidationFailed"));
      }
    })();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/40 p-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-auto w-full max-w-5xl rounded-3xl bg-background p-6 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("addEmployee")}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {setupIncomplete && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {departments.length === 0 && positions.length === 0
                  ? "No departments or positions found."
                  : departments.length === 0 ? "No departments found." : "No positions found."}
              </p>
              <p className="opacity-80">Add at least one Department and Position from Settings before creating employees. The form is disabled until then.</p>
            </div>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/30 p-3">
            <EmployeeAvatar
              id="new"
              name={form.name || form.email || "?"}
              url={form.avatarUrl || null}
              className="h-16 w-16"
            />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Avatar</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" /> Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (!f) return;
                      if (!["image/png","image/jpeg","image/jpg","image/webp"].includes(f.type)) {
                        toast.error("Only PNG, JPEG or WEBP"); return;
                      }
                      if (f.size > 500 * 1024) { toast.error("Image must be 500 KB or less"); return; }
                      const r = new FileReader();
                      r.onload = () => upd("avatarUrl", String(r.result));
                      r.onerror = () => toast.error("Could not read file");
                      r.readAsDataURL(f);
                    }}
                  />
                </label>
                {form.avatarUrl && (
                  <button type="button" onClick={() => upd("avatarUrl", "")} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs">
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
                <input
                  value={form.avatarUrl}
                  onChange={(e) => upd("avatarUrl", e.target.value)}
                  placeholder="or paste image URL…"
                  className={inputCls + " flex-1 min-w-[180px]"}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Email (login)"><input type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} maxLength={120} className={inputCls} /></Field>
            <Field label={t("password")}>
              <input type="text" value={form.password} onChange={(e) => upd("password", e.target.value)} maxLength={64} placeholder="min 6 chars" className={inputCls + " font-mono"} />
            </Field>
            <Field label="Full name"><input value={form.name} onChange={(e) => upd("name", e.target.value)} maxLength={80} className={inputCls} /></Field>
            <Field label="Phone">
              <input type="tel" dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => upd("phone", formatEgPhone(e.target.value))} maxLength={20} placeholder="+20 100 123 4567" className={inputCls + " font-mono"} />
            </Field>
            <Field label="Employee Code">
              <input value={form.empCode} onChange={(e) => upd("empCode", e.target.value)} maxLength={20} placeholder="auto if blank" className={inputCls + " font-mono"} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => upd("status", e.target.value)} className={inputCls}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
            <Field label="City">
              <select value={form.city} onChange={(e) => { upd("city", e.target.value); upd("district", ""); }} className={inputCls}>
                <option value="">—</option>
                {cities.map((c) => <option key={c.id} value={c.name_en}>{c.name_en}</option>)}
              </select>
            </Field>
            <Field label="District">
              {(() => {
                const cityId = cities.find((c) => c.name_en === form.city)?.id;
                const filtered = cityId ? districts.filter((d) => d.city_id === cityId) : [];
                return (
                  <select value={form.district} onChange={(e) => upd("district", e.target.value)} disabled={!cityId} className={inputCls + " disabled:opacity-60"}>
                    <option value="">{cityId ? "—" : "Select a city first"}</option>
                    {filtered.map((d) => <option key={d.id} value={d.name_en}>{d.name_en}</option>)}
                  </select>
                );
              })()}
            </Field>
            <Field label="Department">
              <select value={form.dept} onChange={(e) => upd("dept", e.target.value)} disabled={departments.length === 0} className={inputCls + " disabled:opacity-60"}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Position">
              <select value={form.position} onChange={(e) => upd("position", e.target.value)} disabled={positions.length === 0} className={inputCls + " disabled:opacity-60"}>
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Manager">
              <select value={form.manager} onChange={(e) => upd("manager", e.target.value)} className={inputCls}>
                <option value="">—</option>
                {managers.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </Field>
            <Field label="National ID">
              <input value={form.nationalId} onChange={(e) => upd("nationalId", e.target.value)} maxLength={32} className={inputCls + " font-mono"} />
            </Field>
            <Field label="ID Issue Date">
              <input type="date" value={form.idIssueDate} onChange={(e) => upd("idIssueDate", e.target.value)} className={inputCls + " font-mono"} />
            </Field>
            <Field label="ID Expiry Date">
              <input type="date" value={form.nationalIdExpiry} onChange={(e) => upd("nationalIdExpiry", e.target.value)} className={inputCls + " font-mono"} />
            </Field>
            <Field label="Address on ID">
              <input value={form.idCardAddress} onChange={(e) => upd("idCardAddress", e.target.value)} maxLength={200} placeholder="As written on national ID" className={inputCls} />
            </Field>
            <Field label="Contract Type">
              <select value={form.contractType} onChange={(e) => upd("contractType", e.target.value)} className={inputCls}>
                <option value="FullTime">Full-time</option>
                <option value="PartTime">Part-time</option>
                <option value="Temporary">Temporary</option>
                <option value="Internship">Internship</option>
                <option value="Probation3M">Probation (3 months)</option>
              </select>
            </Field>
            <Field label="Contract Start Date">
              <input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} className={inputCls + " font-mono"} />
            </Field>
            <Field label="Contract End Date">
              <input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} className={inputCls + " font-mono"} />
            </Field>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground md:col-span-3">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={contractCancelled} onChange={(e) => setContractCancelled(e.target.checked)} />
              Contract cancelled
            </label>
            <Field label="Salary Basis">
              <select value={form.salaryMode} onChange={(e) => upd("salaryMode", e.target.value as any)} className={inputCls}>
                <option value="gross">Gross</option>
                <option value="net">Net</option>
              </select>
            </Field>
            <Field label="Salary Gross (EGP)">
              <input
                type="number"
                min={0}
                readOnly={form.salaryMode === "net"}
                value={form.salaryGross || ""}
                onChange={(e) => {
                  const { gross, net } = computeSalaryPair(Number(e.target.value), "gross");
                  upd("salaryGross", gross);
                  upd("salaryNet", net);
                  upd("salary", gross);
                }}
                className={inputCls + " font-mono" + (form.salaryMode === "net" ? " bg-muted/40 text-muted-foreground" : "")}
              />
            </Field>
            <Field label="Salary Net (EGP)">
              <input
                type="number"
                min={0}
                readOnly={form.salaryMode === "gross"}
                value={form.salaryNet || ""}
                onChange={(e) => {
                  const { gross, net } = computeSalaryPair(Number(e.target.value), "net");
                  upd("salaryNet", net);
                  upd("salaryGross", gross);
                  upd("salary", net);
                }}
                className={inputCls + " font-mono" + (form.salaryMode === "gross" ? " bg-muted/40 text-muted-foreground" : "")}
              />
            </Field>
            <Field label="Allowance (EGP)">
              <input type="number" min={0} value={form.allowance || ""} onChange={(e) => upd("allowance", Number(e.target.value))} className={inputCls + " font-mono"} />
            </Field>
            <Field label="Target Value">
              <input type="number" min={0} value={form.target || ""} onChange={(e) => upd("target", Number(e.target.value))} className={inputCls + " font-mono"} />
            </Field>
            <Field label="Target Duration">
              <select value={form.targetDuration} onChange={(e) => upd("targetDuration", e.target.value)} className={inputCls}>
                {["Daily","Weekly","Monthly","Quarterly","Yearly"].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground md:col-span-3">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={allowPastExpiry} onChange={(e) => setAllowPastExpiry(e.target.checked)} />
              Override: allow expiry date in the past (admin/HR only)
            </label>
          </div>
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
        </form>
        <div className="mt-4 flex gap-2 border-t border-border pt-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold">{t("cancel")}</button>
            <button type="button" onClick={submit as any} disabled={setupIncomplete} className="flex-1 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-50 disabled:cursor-not-allowed">{t("create")}</button>
        </div>
      </div>
    </div>
  );
}

type AddTab = "personal" | "employment";
const ADD_TABS: { id: AddTab; labelKey: string }[] = [
  { id: "personal", labelKey: "tabPersonalAddress" },
  { id: "employment", labelKey: "tabEmploymentDocs" },
];
const ADD_DOC_KEYS = [
  "docIdFront", "docIdBack", "docContract",
  "docCriminalFront", "docMilitaryFront", "docMilitaryBack",
  "docBirthCertificate", "docSkillsCert",
] as const;

const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm";

function SearchableSelect({
  value, onChange, options, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) setQuery(""); }, [open]);
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center gap-1 rounded-xl border border-input bg-background px-2.5 py-1.5 text-sm ${disabled ? "opacity-60" : ""}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex-1 truncate text-left"
        >
          {value || <span className="text-muted-foreground">{placeholder || "Select…"}</span>}
        </button>
        {value && !disabled && (
          <button type="button" onClick={() => onChange("")} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Clear">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-background shadow-soft">
          <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder || "Search…"}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1 text-sm">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
            ) : filtered.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  onClick={() => { onChange(o); setOpen(false); }}
                  className={`flex w-full items-center px-3 py-1.5 text-left hover:bg-muted ${o === value ? "bg-muted font-semibold" : ""}`}
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const VALID_CONTRACT_TYPES = ["FullTime", "PartTime", "Temporary", "Internship", "Probation3M"] as const;

const VALID_SALARY_MODES = ["gross", "net"] as const;
const VALID_TARGET_DURATIONS = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"] as const;

function isStrictIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function validateOptionalImportDate(value: string, label: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return isStrictIsoDate(v) ? null : `${label} must be YYYY-MM-DD`;
}

function validateIdExpiry(nationalId: string, exp: string): "ok" | "idExpiryRequired" | "idExpiryInvalid" | "idExpiryInPast" {
  if (!nationalId.trim()) return "ok";
  if (!exp) return "idExpiryRequired";
  if (!isStrictIsoDate(exp)) return "idExpiryInvalid";
  const [year, month, day] = exp.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d.getTime() < today.getTime()) return "idExpiryInPast";
  return "ok";
}

type ExtraHr = {
  personalPhone: string; gender: string; country: string; city: string;
  district: string; street: string; building: string; flat: string;
  nationalId: string; nationalIdExpiry: string; position: string;
  contractType: string; notes: string; manager: string;
  salaryMode: "gross" | "net"; salaryGross: number; salaryNet: number;
  empCode: string; idIssueDate: string; idCardAddress: string; avatarUrl: string;
};
type StoredDoc = { name: string; type: string; size: number; dataUrl: string };

function FieldFull({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ModalDocUpload({ label, doc, onChange }: { label: string; doc?: StoredDoc; onChange: (d: StoredDoc | undefined) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const validate = useServerFn(validateAndStoreDocument);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "uploaded" | "invalid"; reason?: string } | null>(
    doc ? { kind: "uploaded" } : null,
  );
  const accept = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
  const MAX = 2 * 1024 * 1024;

  async function handle(file?: File | null) {
    if (!file) return;
    const okType = ["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(file.type);
    if (!okType) {
      const msg = t("invalidFileType");
      toast.error(msg);
      setStatus({ kind: "invalid", reason: `Unsupported type: ${file.type || "unknown"}` });
      return;
    }
    if (file.size > MAX) {
      const msg = t("fileTooLarge");
      toast.error(msg);
      setStatus({ kind: "invalid", reason: `File too large (${(file.size/1024/1024).toFixed(2)} MB > 2 MB)` });
      return;
    }
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const res = await validate({
        data: { name: file.name, type: file.type, size: file.size, dataUrl },
      });
      onChange({ name: res.name, type: res.type, size: res.size, dataUrl: res.dataUrl });
      setStatus({ kind: "uploaded" });
    } catch (err: any) {
      const code = String(err?.message ?? "").trim();
      const key = code === "fileTooLarge" || code === "invalidFileType" ? code : "uploadRejected";
      toast.error(t(key as any));
      setStatus({ kind: "invalid", reason: code || "Rejected by server validation" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {status && (
          <span
            title={status.reason}
            className={
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
              (status.kind === "uploaded"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-destructive/10 text-destructive")
            }
          >
            {status.kind === "uploaded" ? "Uploaded" : "Invalid"}
          </span>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
      {doc ? (
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-card text-muted-foreground"><FileText className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="block truncate text-xs font-semibold text-foreground">{doc.name}</p>
            <p className="text-[10px] text-muted-foreground">{(doc.size / 1024).toFixed(0)} KB</p>
          </div>
          <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50">{busy ? t("validating") : t("replace")}</button>
          <button type="button" onClick={() => { onChange(undefined); setStatus(null); }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <>
          <button type="button" disabled={busy} onClick={() => ref.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" /> {busy ? t("validating") : t("upload")} <span className="text-[10px] opacity-70">PDF · PNG · JPG · ≤2MB</span>
          </button>
          {status?.kind === "invalid" && status.reason && (
            <p className="mt-1.5 text-[10px] text-destructive">{status.reason}</p>
          )}
        </>
      )}
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("");
}

const TEMPLATE_COLS = [
  "empCode", "name", "email", "phone", "dept", "role", "branch", "status",
  "salary", "salaryMode", "allowance", "target", "targetDuration", "password",
  "personalPhone", "gender", "nationalId", "idIssueDate", "nationalIdExpiry", "idCardAddress",
  "country", "city", "district", "street", "building", "flat",
  "position", "contractType", "manager", "avatarUrl", "notes",
] as const;

function ImportExcelBar() {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const validateBatch = useServerFn(validateEmployeesBatch);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const sample = [{
      empCode: "INT-042", name: "Jane Doe", email: "jane@int.app", phone: "+20 100 123 4567",
      dept: "Engineering", role: "employee", branch: locations[0]?.name ?? "Cairo HQ",
      status: "Active", salary: 15000, salaryMode: "gross", allowance: 1500, target: 20,
      targetDuration: "Monthly", password: "changeme",
      personalPhone: "+20 100 765 4321", gender: "Female",
      nationalId: "29001011234567", idIssueDate: "2020-01-01",
      nationalIdExpiry: "2030-01-01", idCardAddress: "12 Road 9, Maadi, Cairo",
      country: "Egypt", city: "Cairo", district: "Maadi", street: "Road 9",
      building: "12", flat: "3", position: "Senior Developer",
      contractType: "FullTime", manager: "", avatarUrl: "", notes: "",
    }];
    const ws = XLSX.utils.json_to_sheet(sample, { header: [...TEMPLATE_COLS] });
    ws["!cols"] = TEMPLATE_COLS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employees_template.xlsx");
  }

  async function handleFile(file?: File | null) {
    if (!file) return;
    const existingIds = getState().employees.map((emp) => emp.id);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
      // Server-side validation for the whole batch first.
      const candidates = rows.map((r) => ({
        name: String(r.name ?? ""),
        email: String(r.email ?? ""),
        dept: String(r.dept ?? "Engineering"),
        contractType: String(r.contractType ?? "FullTime"),
        salaryMode: String(r.salaryMode ?? "gross").toLowerCase() === "net" ? "net" : "gross",
        targetDuration: String(r.targetDuration ?? "Monthly"),
        manager: String(r.manager ?? ""),
        nationalId: String(r.nationalId ?? ""),
        nationalIdExpiry: String(r.nationalIdExpiry ?? ""),
      }));
      let serverOk: boolean[] = rows.map(() => true);
      try {
        const res = await validateBatch({ data: { employees: candidates, managerIds: existingIds } });
        serverOk = res.results.map((r) => r.ok);
      } catch {
        toast.error(t("serverValidationFailed"));
        return;
      }
      let added = 0;
      let invalid = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!serverOk[i]) { invalid++; continue; }
        const name = String(r.name ?? "").trim();
        const email = String(r.email ?? "").trim();
        const phoneRaw = String(r.phone ?? "").trim();
        if (!name || name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid++; continue; }
        if (phoneRaw && !isValidEgPhone(phoneRaw)) { invalid++; continue; }
        const sal = Number(r.salary) || 0;
        const mode = String(r.salaryMode ?? "gross").toLowerCase() === "net" ? "net" : "gross";
        const dept = String(r.dept ?? "").trim();
        if (!dept) { invalid++; continue; }
        const contractType = String(r.contractType ?? "FullTime");
        if (!(VALID_CONTRACT_TYPES as readonly string[]).includes(contractType)) { invalid++; continue; }
        const targetDuration = String(r.targetDuration ?? "Monthly");
        if (!(VALID_TARGET_DURATIONS as readonly string[]).includes(targetDuration)) { invalid++; continue; }
        const nationalId = String(r.nationalId ?? "");
        const nationalIdExpiry = String(r.nationalIdExpiry ?? "");
        if (validateIdExpiry(nationalId, nationalIdExpiry) !== "ok") { invalid++; continue; }
        const manager = String(r.manager ?? "");
        if (manager && !existingIds.includes(manager)) { invalid++; continue; }
        const salaryGross = mode === "gross" ? sal : Math.round(sal / 0.9);
        const salaryNet = mode === "net" ? sal : Math.round(sal * 0.9);
        addEmployee({
          name, email,
          phone: phoneRaw ? formatEgPhone(phoneRaw) : "",
          dept,
          role: String(r.role ?? ""),
          status: (String(r.status ?? "Active") === "Inactive" ? "Inactive" : "Active"),
          branch: String(r.branch ?? locations[0]?.name ?? ""),
          salary: sal,
          salaryMode: mode,
          salaryGross,
          salaryNet,
          allowance: Number(r.allowance) || 0,
          target: Number(r.target) || 20,
          targetDuration,
          password: String(r.password ?? ""),
          personalPhone: String(r.personalPhone ?? ""),
          gender: String(r.gender ?? ""),
          nationalId,
          nationalIdExpiry,
          country: String(r.country ?? "Egypt"),
          city: String(r.city ?? ""),
          district: String(r.district ?? ""),
          street: String(r.street ?? ""),
          building: String(r.building ?? ""),
          flat: String(r.flat ?? ""),
          position: String(r.position ?? ""),
          contractType,
          manager,
          notes: String(r.notes ?? ""),
        } as any);
        added++;
      }
      toast.success(t("importedCount").replace("{n}", String(added)) + (invalid ? ` · ${invalid} invalid` : ""));
    } catch {
      toast.error(t("importFailed"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-3">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">.xlsx</span>
      <div className="ms-auto flex flex-wrap gap-2">
        <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          <Download className="h-3.5 w-3.5" /> {t("downloadTemplate")}
        </button>
        <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand">
          <Upload className="h-3.5 w-3.5" /> {t("importExcel")}
        </button>
        <input ref={ref} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function ImportExcelInline() {
  const { t } = useI18n();
  return (
    <div className="contents">
      {/* Reuse ImportExcelBar UI but inline: render only the two buttons */}
      <ImportExcelButtonsOnly />
    </div>
  );
}

function ImportExcelButtonsOnly() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const importEmployees = useServerFn(importEmployeesAdmin);
  const [errors, setErrors] = useState<ImportErrors | null>(null);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const sample = [{
      empCode: "INT-042", name: "Jane Doe", email: "jane@int.app", phone: "+20 100 123 4567",
      dept: "Engineering", role: "employee", branch: locations[0]?.name ?? "Cairo HQ",
      status: "Active", salary: 15000, salaryMode: "gross", allowance: 1500, target: 20,
      targetDuration: "Monthly", password: "changeme",
      personalPhone: "+20 100 765 4321", gender: "Female",
      nationalId: "29001011234567", idIssueDate: "2020-01-01",
      nationalIdExpiry: "2030-01-01", idCardAddress: "12 Road 9, Maadi, Cairo",
      country: "Egypt", city: "Cairo", district: "Maadi", street: "Road 9",
      building: "12", flat: "3", position: "Senior Developer",
      contractType: "FullTime", manager: "", avatarUrl: "", notes: "",
    }];
    const ws = XLSX.utils.json_to_sheet(sample, { header: [...TEMPLATE_COLS] });
    ws["!cols"] = TEMPLATE_COLS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employees_template.xlsx");
  }

  async function handleFile(file?: File | null) {
    if (!file) return;
    setErrors(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Strict header validation: must contain every TEMPLATE_COLS header (case-sensitive),
      // reject the whole file if any required header is missing.
      const headerRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false }) as any[];
      const headers: string[] = Array.isArray(headerRows[0])
        ? (headerRows[0] as any[]).map((h) => String(h ?? "").trim())
        : [];
      const required = [...TEMPLATE_COLS];
      const missing = required.filter((c) => !headers.includes(c));
      const unknown = headers.filter((h) => h && !required.includes(h as any));
      const mismatched = required
        .map((expected, i) => ({ column: i + 1, expected, found: headers[i] ?? "(blank)" }))
        .filter((m) => m.expected !== m.found);
      const exactHeaders = headers.length === required.length && required.every((h, i) => headers[i] === h);
      if (!exactHeaders) {
        setErrors({
          fatal: "Template mismatch: headers must exactly match the downloaded employee template.",
          missing, unknown, mismatched, rowIssues: [], totalRows: 0, importedCount: 0,
        });
        toast.error("Import rejected: template headers do not match");
        return;
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
      if (rows.length === 0) {
        setErrors({ fatal: "No data rows found in the file.", missing: [], unknown, mismatched: [], rowIssues: [], totalRows: 0, importedCount: 0 });
        return;
      }
      const allowedRoles = new Set(["admin", "hr", "manager", "employee"]);
      const rowIssues: { row: number; name?: string; email?: string; reasons: string[] }[] = [];
      const validRows: Record<string, any>[] = [];
      const validRowNumbers: number[] = [];
      const seenEmpCodes = new Map<string, number>(); // empCode -> first row number
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = String(r.name ?? "").trim();
        const email = String(r.email ?? "").trim().toLowerCase();
        const phoneRaw = String(r.phone ?? "").trim();
        const empCode = String(r.empCode ?? "").trim();
        const reasons: string[] = [];
        if (!name || name.length < 2) reasons.push("Name is required (min 2 chars)");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reasons.push("Valid email required");
        if (phoneRaw && !isValidEgPhone(phoneRaw)) reasons.push("Invalid Egyptian phone");
        if (empCode) {
          if (empCode.length > 40) reasons.push("Employee code must be 40 chars or less");
          const prev = seenEmpCodes.get(empCode);
          if (prev !== undefined) {
            reasons.push(`Duplicate employee code in file (also row ${prev}): ${empCode}`);
          }
        }
        const role = String(r.role ?? "employee").trim().toLowerCase() || "employee";
        if (!allowedRoles.has(role)) reasons.push(`Invalid role: ${role}`);
        const avatarUrl = String(r.avatarUrl ?? "").trim();
        if (avatarUrl && !/^https?:\/\//i.test(avatarUrl) && !/^data:image\/(png|jpe?g|webp);base64,/i.test(avatarUrl)) {
          reasons.push("Avatar must be a WEBP, PNG, JPEG data URL or http(s) URL");
        }
        const issueDateError = validateOptionalImportDate(String(r.idIssueDate ?? ""), "ID issue date");
        if (issueDateError) reasons.push(issueDateError);
        const expCheck = validateIdExpiry(String(r.nationalId ?? ""), String(r.nationalIdExpiry ?? ""));
        if (expCheck === "idExpiryInvalid") reasons.push("ID expiry date must be YYYY-MM-DD");
        else if (expCheck !== "ok") reasons.push(t(expCheck as any));
        if (reasons.length > 0) {
          rowIssues.push({ row: i + 2, name, email, reasons });
          continue;
        }
        if (empCode) seenEmpCodes.set(empCode, i + 2);
        validRows.push({ ...r, name, email, phone: phoneRaw ? formatEgPhone(phoneRaw) : "", role, avatarUrl });
        validRowNumbers.push(i + 2);
      }
      let added = 0;
      if (validRows.length > 0) {
        const res = await importEmployees({
          data: {
            employees: validRows,
            loginUrl: `${window.location.origin}/auth`,
            appName: document.title || "HR Portal",
          },
        });
        added = res.importedCount;
        res.results.forEach((r) => {
          if (!r.ok) {
            const original = validRows[r.index] ?? {};
            rowIssues.push({
              row: validRowNumbers[r.index] ?? r.index + 2,
              name: String(original.name ?? ""),
              email: String(original.email ?? ""),
              reasons: [r.error ?? "Import failed"],
            });
          }
        });
      }
      const invalid = rowIssues.length;
      if (invalid > 0) {
        setErrors({
          fatal: null, missing: [], unknown: [], mismatched: [], rowIssues,
          totalRows: rows.length, importedCount: added,
        });
      }
      if (added > 0) {
        qc.invalidateQueries({ queryKey: ["admin", "employees", "list"] });
        toast.success(t("importedCount").replace("{n}", String(added)) + (invalid ? ` · ${invalid} invalid` : ""));
      } else if (invalid > 0) {
        toast.error(`${invalid} row${invalid > 1 ? "s" : ""} rejected — see error panel`);
      }
    } catch { toast.error(t("importFailed")); }
  }

  return (
    <>
      <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold">
        <Download className="h-4 w-4" /> {t("downloadTemplate")}
      </button>
      <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
        <Upload className="h-4 w-4" /> {t("importExcel")}
      </button>
      <input ref={ref} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      {errors && <ImportErrorPanel errors={errors} onClose={() => setErrors(null)} />}
    </>
  );
}

type ImportErrors = {
  fatal: string | null;
  missing: string[];
  unknown: string[];
  mismatched: { column: number; expected: string; found: string }[];
  rowIssues: { row: number; name?: string; email?: string; reasons: string[] }[];
  totalRows: number;
  importedCount: number;
};

function ImportErrorPanel({ errors, onClose }: { errors: ImportErrors; onClose: () => void }) {
  const { rowIssues, missing, unknown, mismatched, fatal, totalRows, importedCount } = errors;
  async function exportReport() {
    const XLSX = await import("xlsx");
    const data = rowIssues.map((r) => ({
      row: r.row, name: r.name ?? "", email: r.email ?? "",
      reasons: r.reasons.join("; "),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, `import_errors_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl rounded-3xl bg-background p-6 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-destructive">Import errors</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {fatal && (
          <div className="mb-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold text-destructive">{fatal}</p>
            {missing.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Missing columns: <span className="font-mono">{missing.join(", ")}</span>
              </p>
            )}
            {mismatched.length > 0 && (
              <div className="mt-2 max-h-28 overflow-y-auto rounded-xl bg-background/70 p-2 text-xs">
                {mismatched.slice(0, 12).map((m) => (
                  <p key={m.column} className="font-mono text-muted-foreground">
                    Column {m.column}: expected {m.expected}, found {m.found}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {!fatal && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Total rows: <span className="font-semibold text-foreground">{totalRows}</span></span>
            <span>Imported: <span className="font-semibold text-emerald-600">{importedCount}</span></span>
            <span>Failed: <span className="font-semibold text-destructive">{rowIssues.length}</span></span>
          </div>
        )}
        {unknown.length > 0 && (
          <div className="mb-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <p className="font-semibold text-amber-600">Unknown columns ignored:</p>
            <p className="mt-1 font-mono">{unknown.join(", ")}</p>
          </div>
        )}
        {rowIssues.length > 0 && (
          <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">Row</th>
                  <th className="px-3 py-2 text-start font-medium">Name</th>
                  <th className="px-3 py-2 text-start font-medium">Email</th>
                  <th className="px-3 py-2 text-start font-medium">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {rowIssues.map((r) => (
                  <tr key={r.row} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">{r.row}</td>
                    <td className="px-3 py-2">{r.name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.email || "—"}</td>
                    <td className="px-3 py-2">
                      <ul className="space-y-0.5 text-xs text-destructive">
                        {r.reasons.map((re, i) => <li key={i}>• {re}</li>)}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {rowIssues.length > 0 && (
            <button onClick={exportReport}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" /> Export error report
            </button>
          )}
          <button onClick={onClose} className="rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand">Close</button>
        </div>
      </div>
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => <th className="px-4 py-3 text-start font-medium">{children}</th>;
const Td = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => <td className={`px-4 py-3 ${mono ? "font-mono text-xs tabular-nums" : ""}`}>{children}</td>;
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </label>
  );
}

function ContractDaysBadge({ endDate, cancelled }: { endDate: string | null; cancelled?: boolean | null }) {
  if (!endDate) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">—</span>
          </TooltipTrigger>
          <TooltipContent>No contract end date</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);
  const absDays = Math.abs(days);
  const plural = absDays === 1 ? "" : "s";

  if (cancelled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <Ban className="h-3 w-3" /> Cancelled
            </span>
          </TooltipTrigger>
          <TooltipContent>Contract was cancelled</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (days < 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              <AlertCircle className="h-3 w-3" /> Expired {absDays} day{plural}
            </span>
          </TooltipTrigger>
          <TooltipContent>Contract ended {absDays} day{plural} ago</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (days <= 30) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
              <AlertTriangle className="h-3 w-3" /> {days} day{plural} left
            </span>
          </TooltipTrigger>
          <TooltipContent>Contract expires in {days} day{plural} — renewal recommended</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> {days} day{plural} left
          </span>
        </TooltipTrigger>
        <TooltipContent>Contract expires in {days} day{plural}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
