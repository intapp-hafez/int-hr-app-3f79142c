import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Download, FileSpreadsheet } from "lucide-react";
import {
  listDepartments, upsertDepartment, deleteDepartment,
  listPositions, upsertPosition, deletePosition,
  listCitiesWithDistricts, upsertCity, deleteCity, upsertDistrict, deleteDistrict,
} from "@/backend/functions/directory.functions";
import { listCitiesAndDistricts } from "@/backend/functions/employees.functions";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { NetworksManager } from "./admin.networks";

const ContractTemplatesManager = lazy(() => import("@/components/ContractTemplatesManager").then((mod) => ({ default: mod.ContractTemplatesManager })));

type Tab = "departments" | "positions" | "cities" | "networks" | "contractTemplates";
const validTabs: Tab[] = ["departments", "positions", "cities", "networks", "contractTemplates"];

export const Route = createFileRoute("/admin/directory")({
  component: DirectoryPage,
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => {
    const t = s.tab as string | undefined;
    return { tab: t && validTabs.includes(t as Tab) ? (t as Tab) : undefined };
  },
});

const tabs: { id: Tab; label: string }[] = [
  { id: "departments", label: "Departments" },
  { id: "positions", label: "Positions" },
  { id: "cities", label: "Cities & Districts" },
  { id: "networks", label: "Networks" },
  { id: "contractTemplates", label: "Contract Templates" },
];

const PAGE_SIZE = 10;

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-2 text-sm">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-muted-foreground">Page {page} of {pageCount}</span>
      <button
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

function usePaged<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return { page: safePage, pageCount, setPage, slice };
}

function DirectoryPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: Tab = search.tab ?? "departments";
  const setTab = (t: Tab) => navigate({ search: { tab: t }, replace: true });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Directory</h1>
        <p className="text-sm text-muted-foreground">Manage departments, positions, locations, and leave types.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              tab === tb.id ? "border-brand bg-brand text-brand-foreground shadow-brand"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}>
            {tb.label}
          </button>
        ))}
      </div>
      <div className="rounded-3xl border border-border bg-card p-5">
        {tab === "departments" && <NamedSection kind="departments" />}
        {tab === "positions" && <NamedSection kind="positions" />}
        {tab === "cities" && <CitiesSection />}
        {tab === "networks" && <NetworksManager />}
        {tab === "contractTemplates" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <ContractTemplatesManager />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function NamedSection({ kind }: { kind: "departments" | "positions" }) {
  const qc = useQueryClient();
  const list = useServerFn(kind === "departments" ? listDepartments : listPositions);
  const upsert = useServerFn(kind === "departments" ? upsertDepartment : upsertPosition);
  const del = useServerFn(kind === "departments" ? deleteDepartment : deletePosition);
  const key = [kind];
  const q = useQuery({ queryKey: key, queryFn: () => list() });
  const isDept = kind === "departments";
  const listMgrs = useServerFn(listCitiesAndDistricts);
  const mgrQ = useQuery({
    queryKey: ["dept-responsibles"],
    queryFn: () => listMgrs(),
    enabled: isDept,
    staleTime: 5 * 60_000,
  });
  const managers: Array<{ id: string; name: string }> = (mgrQ.data as any)?.managers ?? [];
  const mUpsert = useMutation({
    mutationFn: (row: { id?: string; name_en: string; name_ar: string; active?: boolean; responsible_person_id?: string | null }) => upsert({ data: row }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [draft, setDraft] = useState<{ name_en: string; name_ar: string; responsible_person_id: string }>({ name_en: "", name_ar: "", responsible_person_id: "" });

  const headers = ["name_en", "name_ar", "active"];
  const paged = usePaged<any>(q.data ?? []);

  async function handleImport(file: File) {
    try {
      const rows = await parseExcelFile<{ name_en?: string; name_ar?: string; active?: string | boolean }>(file);
      let ok = 0; let fail = 0;
      for (const r of rows) {
        const name_en = String(r.name_en ?? "").trim();
        if (!name_en) { fail++; continue; }
        try {
          await mUpsert.mutateAsync({
            name_en, name_ar: String(r.name_ar ?? "").trim(),
            active: r.active === false || String(r.active).toLowerCase() === "false" ? false : true,
          });
          ok++;
        } catch { fail++; }
      }
      toast.success(`Imported ${ok}, failed ${fail}`);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <Toolbar
        onTemplate={() => downloadTemplate(`${kind}_template.xlsx`, headers, [{ name_en: "Sales", name_ar: "المبيعات", active: true }])}
        onImport={handleImport}
      />
      <div className={`grid gap-3 ${isDept ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <input className={inputCls} placeholder="Name (EN)" value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} />
        <input className={inputCls} placeholder="Name (AR)" value={draft.name_ar} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} />
        {isDept && (
          <select
            className={inputCls}
            value={draft.responsible_person_id}
            onChange={(e) => setDraft({ ...draft, responsible_person_id: e.target.value })}
          >
            <option value="">Responsible person…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => {
            if (!draft.name_en) return toast.error("Name required");
            mUpsert.mutate({
              name_en: draft.name_en,
              name_ar: draft.name_ar,
              active: true,
              ...(isDept ? { responsible_person_id: draft.responsible_person_id || null } : {}),
            });
            setDraft({ name_en: "", name_ar: "", responsible_person_id: "" });
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      <Table cols={isDept ? ["Name (EN)", "Name (AR)", "Responsible", "Active", ""] : ["Name (EN)", "Name (AR)", "Active", ""]}>
        {paged.slice.map((r: any) => (
          <tr key={r.id} className="hover:bg-muted/30">
            <td className="px-3 py-2 font-medium">{r.name_en}</td>
            <td className="px-3 py-2">{r.name_ar}</td>
            {isDept && (
              <td className="px-3 py-2">
                <select
                  className={inputCls}
                  value={r.responsible_person_id ?? ""}
                  onChange={(e) =>
                    mUpsert.mutate({
                      id: r.id, name_en: r.name_en, name_ar: r.name_ar, active: r.active,
                      responsible_person_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">—</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                  {r.responsible_person_id && !managers.find((m) => m.id === r.responsible_person_id) && (
                    <option value={r.responsible_person_id}>{r.responsible_person_name ?? "(unknown)"}</option>
                  )}
                </select>
              </td>
            )}
            <td className="px-3 py-2">
              <button onClick={() => mUpsert.mutate({ id: r.id, name_en: r.name_en, name_ar: r.name_ar, active: !r.active })}
                className={`rounded-full px-2 py-1 text-xs ${r.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {r.active ? "Yes" : "No"}
              </button>
            </td>
            <td className="px-3 py-2 text-end">
              <button onClick={() => mDel.mutate(r.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} />
    </div>
  );
}

function CitiesSection() {
  const qc = useQueryClient();
  const list = useServerFn(listCitiesWithDistricts);
  const upC = useServerFn(upsertCity);
  const delC = useServerFn(deleteCity);
  const upD = useServerFn(upsertDistrict);
  const delD = useServerFn(deleteDistrict);
  const q = useQuery({ queryKey: ["cities"], queryFn: () => list() });
  const inv = () => qc.invalidateQueries({ queryKey: ["cities"] });
  const mC = useMutation({ mutationFn: (r: any) => upC({ data: r }), onSuccess: () => { inv(); toast.success("Saved"); }, onError: (e: Error) => toast.error(e.message) });
  const mDC = useMutation({ mutationFn: (id: string) => delC({ data: { id } }), onSuccess: () => { inv(); toast.success("Deleted"); }, onError: (e: Error) => toast.error(e.message) });
  const mD = useMutation({ mutationFn: (r: any) => upD({ data: r }), onSuccess: () => { inv(); toast.success("Saved"); }, onError: (e: Error) => toast.error(e.message) });
  const mDD = useMutation({ mutationFn: (id: string) => delD({ data: { id } }), onSuccess: () => { inv(); toast.success("Deleted"); }, onError: (e: Error) => toast.error(e.message) });
  const [city, setCity] = useState({ name_en: "", name_ar: "" });
  const [districtDraft, setDistrictDraft] = useState<Record<string, { name_en: string; name_ar: string }>>({});
  const paged = usePaged<any>(q.data ?? []);

  async function handleImport(file: File) {
    try {
      const rows = await parseExcelFile<{ city_en?: string; city_ar?: string; district_en?: string; district_ar?: string }>(file);
      const cityMap = new Map<string, string>(); // name_en -> id (after upsert we'll re-fetch)
      // First pass: collect unique cities
      const cities = Array.from(new Set(rows.map((r) => String(r.city_en ?? "").trim()).filter(Boolean)));
      for (const c of cities) {
        const row = rows.find((r) => String(r.city_en).trim() === c)!;
        await mC.mutateAsync({ name_en: c, name_ar: String(row.city_ar ?? "").trim() });
      }
      // Refetch and map ids
      const fresh: any[] = await list();
      for (const c of fresh) cityMap.set(c.name_en, c.id);
      let ok = 0; let fail = 0;
      for (const r of rows) {
        const cityId = cityMap.get(String(r.city_en ?? "").trim());
        const dn = String(r.district_en ?? "").trim();
        if (!cityId || !dn) { fail++; continue; }
        try {
          await mD.mutateAsync({ city_id: cityId, name_en: dn, name_ar: String(r.district_ar ?? "").trim() });
          ok++;
        } catch { fail++; }
      }
      toast.success(`Imported ${ok} districts, failed ${fail}`);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <Toolbar
        onTemplate={() => downloadTemplate("cities_districts_template.xlsx",
          ["city_en", "city_ar", "district_en", "district_ar"],
          [{ city_en: "Cairo", city_ar: "القاهرة", district_en: "Maadi", district_ar: "المعادي" }])}
        onImport={handleImport}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input className={inputCls} placeholder="City (EN)" value={city.name_en} onChange={(e) => setCity({ ...city, name_en: e.target.value })} />
        <input className={inputCls} placeholder="City (AR)" value={city.name_ar} onChange={(e) => setCity({ ...city, name_ar: e.target.value })} />
        <button onClick={() => {
          const name = city.name_en.trim();
          if (!name) return toast.error("City name required");
          if (q.data?.some((c: any) => c.name_en.trim().toLowerCase() === name.toLowerCase())) return toast.error(`City "${name}" already exists`);
          mC.mutate(city); setCity({ name_en: "", name_ar: "" });
        }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
          <Plus className="h-4 w-4" /> Add City
        </button>
      </div>
      <div className="space-y-3">
        {paged.slice.map((c: any) => {
          const d = districtDraft[c.id] ?? { name_en: "", name_ar: "" };
          return (
            <div key={c.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{c.name_en}</p>
                  <p className="text-xs text-muted-foreground">{c.name_ar}</p>
                </div>
                <button onClick={() => mDC.mutate(c.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(c.districts ?? []).map((d2: any) => (
                  <span key={d2.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                    {d2.name_en}
                    <button onClick={() => mDD.mutate(d2.id)} className="ml-1 text-destructive">×</button>
                  </span>
                ))}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <input className={inputCls} placeholder="District (EN)" value={d.name_en} onChange={(e) => setDistrictDraft({ ...districtDraft, [c.id]: { ...d, name_en: e.target.value } })} />
                <input className={inputCls} placeholder="District (AR)" value={d.name_ar} onChange={(e) => setDistrictDraft({ ...districtDraft, [c.id]: { ...d, name_ar: e.target.value } })} />
                <button onClick={() => {
                  const dn = d.name_en.trim();
                  if (!dn) return toast.error("District name required");
                  if ((c.districts ?? []).some((x: any) => x.name_en.trim().toLowerCase() === dn.toLowerCase())) return toast.error(`District "${dn}" already exists in this city`);
                  mD.mutate({ city_id: c.id, name_en: d.name_en, name_ar: d.name_ar }); setDistrictDraft({ ...districtDraft, [c.id]: { name_en: "", name_ar: "" } });
                }}
                  className="rounded-xl bg-foreground px-3 py-2 text-sm font-semibold text-background">
                  Add district
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} />
    </div>
  );
}

function LeaveTypesSection() {
  const qc = useQueryClient();
  const list = useServerFn(listLeaveTypes);
  const upsert = useServerFn(upsertLeaveType);
  const del = useServerFn(deleteLeaveType);
  const q = useQuery({ queryKey: ["leave_types"], queryFn: () => list() });
  const m = useMutation({ mutationFn: (r: any) => upsert({ data: r }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave_types"] }); toast.success("Saved"); }, onError: (e: Error) => toast.error(e.message) });
  const mD = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave_types"] }); toast.success("Deleted"); }, onError: (e: Error) => toast.error(e.message) });
  const [draft, setDraft] = useState({ name: "", annual_days: 0, paid: true, active: true, requires_proof: false });
  const paged = usePaged<any>(q.data ?? []);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-6">
        <input className={`${inputCls} md:col-span-2`} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className={inputCls} type="number" placeholder="Annual days" value={draft.annual_days} onChange={(e) => setDraft({ ...draft, annual_days: Number(e.target.value) })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.paid} onChange={(e) => setDraft({ ...draft, paid: e.target.checked })} /> Paid</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.requires_proof} onChange={(e) => setDraft({ ...draft, requires_proof: e.target.checked })} /> Requires proof</label>
        <button onClick={() => { if (!draft.name) return toast.error("Name required"); m.mutate(draft); setDraft({ name: "", annual_days: 0, paid: true, active: true, requires_proof: false }); }}
          className="rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">Add</button>
      </div>
      <Table cols={["Name", "Annual days", "Paid", "Requires proof", "Active", ""]}>
        {paged.slice.map((r: any) => (
          <tr key={r.id}>
            <td className="px-3 py-2 font-medium">{r.name}</td>
            <td className="px-3 py-2">{r.annual_days}</td>
            <td className="px-3 py-2">{r.paid ? "Yes" : "No"}</td>
            <td className="px-3 py-2">
              <button onClick={() => m.mutate({ ...r, requires_proof: !r.requires_proof })} className={`rounded-full px-2 py-1 text-xs ${r.requires_proof ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                {r.requires_proof ? "Yes" : "No"}
              </button>
            </td>
            <td className="px-3 py-2">
              <button onClick={() => m.mutate({ ...r, active: !r.active })} className={`rounded-full px-2 py-1 text-xs ${r.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {r.active ? "Yes" : "No"}
              </button>
            </td>
            <td className="px-3 py-2 text-end">
              <button onClick={() => mD.mutate(r.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} />
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring";

function Table({ cols, children }: { cols: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-start font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function Toolbar({ onTemplate, onImport }: { onTemplate: () => void; onImport: (f: File) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={onTemplate} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm">
        <Download className="h-4 w-4" /> Download template
      </button>
      <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm cursor-pointer">
        <Upload className="h-4 w-4" /> Import from Excel
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
      </label>
      <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5" /> .xlsx, .csv supported
      </span>
    </div>
  );
}