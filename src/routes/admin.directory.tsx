import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Download, FileSpreadsheet, Pencil, Check, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  listDepartments, upsertDepartment, deleteDepartment,
  listPositions, upsertPosition, deletePosition,
  listJobGrades, upsertJobGrade, deleteJobGrade,
  listGraduations, upsertGraduation, deleteGraduation,
  listMajors, upsertMajor, deleteMajor,
  listCitiesWithDistricts, upsertCity, deleteCity, upsertDistrict, deleteDistrict,
} from "@/backend/functions/directory.functions";
import { listCitiesAndDistricts } from "@/backend/functions/employees.functions";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { NetworksManager } from "./admin.networks";
import { DepartmentStructureModal } from "@/components/admin/DepartmentStructureModal";
import { DepartmentSectionsModal } from "@/components/admin/DepartmentSectionsModal";
import { SectionsManager } from "@/components/admin/SectionsManager";
import { SmsBroadcastTab } from "@/components/admin/SmsBroadcastTab";
import { DevicesManager } from "@/components/admin/DevicesManager";
import { CostCentersManager } from "@/components/admin/CostCentersManager";

const ContractTemplatesManager = lazy(() => import("@/components/ContractTemplatesManager").then((mod) => ({ default: mod.ContractTemplatesManager })));
const ExperienceCertificate = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.ExperienceCertificate })));
const SalaryCertificate = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.SalaryCertificate })));
const AdvancesAcknowledgment = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.AdvancesAcknowledgment })));
const CustodyAcknowledgment = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.CustodyAcknowledgment })));
const LoanRequestForm = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.LoanRequestForm })));
const InvestigationForm = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.InvestigationForm })));
const FirstWarningForm = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.FirstWarningForm })));
const SecondWarningForm = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.SecondWarningForm })));
const SocialInsuranceForm1 = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.SocialInsuranceForm1 })));
const SocialInsuranceForm6 = lazy(() => import("@/components/admin/HrDocuments").then((mod) => ({ default: mod.SocialInsuranceForm6 })));
const ExitInterviewReport = lazy(() => import("@/components/admin/ExitInterviewReport").then((mod) => ({ default: mod.ExitInterviewReport })));
const ResignationForm = lazy(() => import("@/components/admin/ResignationForm").then((mod) => ({ default: mod.ResignationForm })));
const FinalSettlementReport = lazy(() => import("@/components/admin/FinalSettlementReport").then((mod) => ({ default: mod.FinalSettlementReport })));

type Tab = "departments" | "sections" | "positions" | "job_grades" | "graduations" | "majors" | "cities" | "cost_centers" | "networks" | "devices" | "contractTemplates" | "sms" | "experienceCertificate" | "salaryDetails" | "advancesAck" | "custodyAck" | "loanRequest" | "investigation" | "warning1" | "warning2" | "socialIns1" | "socialIns6" | "exitInterview" | "resignation" | "finalSettlement";
const validTabs: Tab[] = ["departments", "sections", "positions", "job_grades", "graduations", "majors", "cities", "cost_centers", "networks", "devices", "contractTemplates", "sms", "experienceCertificate", "salaryDetails", "advancesAck", "custodyAck", "loanRequest", "investigation", "warning1", "warning2", "socialIns1", "socialIns6", "exitInterview", "resignation", "finalSettlement"];

export const Route = createFileRoute("/admin/directory")({
  component: DirectoryPage,
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => {
    let t = s.tab as string | undefined;
    if (t === "expSalary") t = "experienceCertificate";
    if (t === "advCustodyAck") t = "advancesAck";
    return { tab: t && validTabs.includes(t as Tab) ? (t as Tab) : undefined };
  },
});

const tabs: { id: Tab; label: string }[] = [
  { id: "departments", label: "Departments" },
  { id: "sections", label: "Levels" },
  { id: "positions", label: "Positions" },
  { id: "job_grades", label: "Job Grades" },
  { id: "graduations", label: "Graduations" },
  { id: "majors", label: "Majors" },
  { id: "cities", label: "Cities & Districts" },
  { id: "cost_centers", label: "Cost Centers" },
  { id: "networks", label: "Networks" },
  { id: "devices", label: "Devices" },
  { id: "contractTemplates", label: "Contract Templates" },
  { id: "sms", label: "SMS Broadcast" },
  { id: "experienceCertificate", label: "Experience Certificate" },
  { id: "salaryDetails", label: "Salary Certificate" },
  { id: "advancesAck", label: "Advances Acknowledgment" },
  { id: "custodyAck", label: "Custody Acknowledgment" },
  { id: "loanRequest", label: "Loan Request Form" },
  { id: "investigation", label: "Investigation Form" },
  { id: "warning1", label: "First Warning" },
  { id: "warning2", label: "Second Warning" },
  { id: "socialIns1", label: "Form 1 (س1)" },
  { id: "socialIns6", label: "Form 6 (س6)" },
  { id: "exitInterview", label: "Exit Interview (مقابلة نهاية الخدمة)" },
  { id: "resignation", label: "Resignation Form (طلب استقالة)" },
  { id: "finalSettlement", label: "Final Settlement & Clearance (مخالصة وإخلاء طرف)" },
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
        {tab === "sections" && <SectionsManager />}
        {tab === "positions" && <NamedSection kind="positions" />}
        {tab === "job_grades" && <NamedSection kind="job_grades" />}
        {tab === "graduations" && <NamedSection kind="graduations" />}
        {tab === "majors" && <NamedSection kind="majors" />}
        {tab === "cities" && <CitiesSection />}
        {tab === "cost_centers" && <CostCentersManager />}
        {tab === "networks" && <NetworksManager />}
        {tab === "devices" && <DevicesManager />}
        {tab === "contractTemplates" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <ContractTemplatesManager />
          </Suspense>
        )}
        {tab === "sms" && <SmsBroadcastTab />}
        {tab === "experienceCertificate" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <ExperienceCertificate />
          </Suspense>
        )}
        {tab === "salaryDetails" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <SalaryCertificate />
          </Suspense>
        )}
        {tab === "advancesAck" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <AdvancesAcknowledgment />
          </Suspense>
        )}
        {tab === "loanRequest" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <LoanRequestForm />
          </Suspense>
        )}
        {tab === "custodyAck" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <CustodyAcknowledgment />
          </Suspense>
        )}
        {tab === "investigation" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <InvestigationForm />
          </Suspense>
        )}
        {tab === "warning1" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <FirstWarningForm />
          </Suspense>
        )}
        {tab === "warning2" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <SecondWarningForm />
          </Suspense>
        )}
        {tab === "socialIns1" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <SocialInsuranceForm1 />
          </Suspense>
        )}
        {tab === "socialIns6" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <SocialInsuranceForm6 />
          </Suspense>
        )}
        {tab === "exitInterview" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <ExitInterviewReport />
          </Suspense>
        )}
        {tab === "resignation" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <ResignationForm />
          </Suspense>
        )}
        {tab === "finalSettlement" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <FinalSettlementReport />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function computeNextCode(items: Array<{ code?: string | null }>): string {
  const codes = items.map((i) => (i.code ?? "").trim()).filter(Boolean);
  if (codes.length === 0) return "101";

  const numericCodes = codes
    .filter((c) => /^\d+$/.test(c))
    .map((c) => parseInt(c, 10))
    .filter((n) => !isNaN(n));

  if (numericCodes.length > 0) {
    const max = Math.max(...numericCodes);
    return String(max + 1);
  }

  const prefixMatches = codes
    .map((c) => c.match(/^([A-Za-z_-]+)(\d+)$/))
    .filter((m): m is RegExpMatchArray => m !== null);

  if (prefixMatches.length > 0) {
    const prefix = prefixMatches[0][1];
    const numPart = prefixMatches.map((m) => parseInt(m[2], 10));
    const padLen = prefixMatches[0][2].length;
    const nextNum = Math.max(...numPart) + 1;
    return `${prefix}${String(nextNum).padStart(padLen, "0")}`;
  }

  return "101";
}

function NamedSection({ kind }: { kind: "departments" | "positions" | "job_grades" | "graduations" | "majors" }) {
  const qc = useQueryClient();
  const list = useServerFn(
    kind === "departments" ? listDepartments :
    kind === "positions" ? listPositions :
    kind === "job_grades" ? listJobGrades :
    kind === "graduations" ? listGraduations : listMajors
  );
  const upsert = useServerFn(
    kind === "departments" ? upsertDepartment :
    kind === "positions" ? upsertPosition :
    kind === "job_grades" ? upsertJobGrade :
    kind === "graduations" ? upsertGraduation : upsertMajor
  );
  const del = useServerFn(
    kind === "departments" ? deleteDepartment :
    kind === "positions" ? deletePosition :
    kind === "job_grades" ? deleteJobGrade :
    kind === "graduations" ? deleteGraduation : deleteMajor
  );
  const key = [kind];
  const q = useQuery({ queryKey: key, queryFn: () => list() });
  const isDept = kind === "departments";

  const nextCode = useMemo(() => {
    return isDept ? computeNextCode(q.data ?? []) : "";
  }, [q.data, isDept]);

  const [codeSort, setCodeSort] = useState<"asc" | "desc" | null>(isDept ? "asc" : null);
  const toggleCodeSort = () => {
    setCodeSort((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
  };

  const listMgrs = useServerFn(listCitiesAndDistricts);
  const mgrQ = useQuery({
    queryKey: ["dept-responsibles"],
    queryFn: () => listMgrs(),
    enabled: isDept,
    staleTime: 5 * 60_000,
  });
  const managers: Array<{ id: string; name: string }> = (mgrQ.data as any)?.managers ?? [];
  const mUpsert = useMutation({
    mutationFn: (row: { id?: string; name_en: string; name_ar: string; active?: boolean; responsible_person_id?: string | null; code?: string | null; parent_id?: string | null; reports_to_position_id?: string | null }) => upsert({ data: row }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Saved");
      setDraft({ name_en: "", name_ar: "", responsible_person_id: "", code: "", parent_id: "", reports_to_position_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [draft, setDraft] = useState<{ name_en: string; name_ar: string; responsible_person_id: string; code: string; parent_id: string; reports_to_position_id: string }>({ name_en: "", name_ar: "", responsible_person_id: "", code: "", parent_id: "", reports_to_position_id: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name_en: string; name_ar: string; active: boolean; responsible_person_id: string; code: string; parent_id: string; reports_to_position_id: string }>({ name_en: "", name_ar: "", active: true, responsible_person_id: "", code: "", parent_id: "", reports_to_position_id: "" });
  const [structureDept, setStructureDept] = useState<{ id: string; name_en: string } | null>(null);
  const [sectionsDept, setSectionsDept] = useState<{ id: string; name_en: string } | null>(null);

  useEffect(() => {
    if (isDept && nextCode && !draft.code) {
      setDraft((d) => ({ ...d, code: nextCode }));
    }
  }, [nextCode, isDept]);

  function handleSaveEdit(id: string) {
    if (!editDraft.name_en.trim()) return toast.error("Name (EN) required");
    mUpsert.mutate(
      {
        id,
        name_en: editDraft.name_en.trim(),
        name_ar: editDraft.name_ar.trim(),
        active: editDraft.active,
        code: editDraft.code.trim() || null,
        parent_id: editDraft.parent_id || null,
        reports_to_position_id: editDraft.reports_to_position_id || null,
        ...(isDept ? { responsible_person_id: editDraft.responsible_person_id || null } : {}),
      },
      {
        onSuccess: () => setEditingId(null),
      }
    );
  }

  const headers = ["name_en", "name_ar", "active"];

  const sortedData = useMemo(() => {
    const items = [...(q.data ?? [])];
    if (codeSort === "asc") {
      items.sort((a: any, b: any) => {
        const ca = (a.code ?? "").trim();
        const cb = (b.code ?? "").trim();
        if (!ca && !cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb, undefined, { numeric: true, sensitivity: "base" });
      });
    } else if (codeSort === "desc") {
      items.sort((a: any, b: any) => {
        const ca = (a.code ?? "").trim();
        const cb = (b.code ?? "").trim();
        if (!ca && !cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        return cb.localeCompare(ca, undefined, { numeric: true, sensitivity: "base" });
      });
    }
    return items;
  }, [q.data, codeSort]);

  const paged = usePaged<any>(sortedData);

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

  async function handleExport() {
    const list = q.data ?? [];
    if (list.length === 0) {
      toast.error("No data to export");
      return;
    }
    const XLSX = await import("xlsx");
    let exportRows: Record<string, any>[] = [];

    if (kind === "departments") {
      exportRows = list.map((d: any) => ({
        "Code": d.code ?? "",
        "Name (EN)": d.name_en ?? "",
        "Name (AR)": d.name_ar ?? "",
        "Sections": d.sections_names ?? "",
        "Responsible Person": d.responsible_person_name ?? "",
        "Status": d.active ? "Active" : "Inactive",
      }));
    } else if (kind === "positions") {
      exportRows = list.map((p: any) => ({
        "Code": p.code ?? "",
        "Name (EN)": p.name_en ?? "",
        "Name (AR)": p.name_ar ?? "",
        "Reports To": p.reports_to_name ?? "",
        "Status": p.active ? "Active" : "Inactive",
      }));
    } else if (kind === "job_grades") {
      exportRows = list.map((j: any) => ({
        "Code": j.code ?? "",
        "Name (EN)": j.name_en ?? "",
        "Name (AR)": j.name_ar ?? "",
        "Status": j.active ? "Active" : "Inactive",
      }));
    } else if (kind === "graduations") {
      exportRows = list.map((g: any) => ({
        "Graduation (EN)": g.name_en ?? "",
        "Graduation (AR)": g.name_ar ?? "",
        "Status": g.active ? "Active" : "Inactive",
      }));
    } else if (kind === "majors") {
      exportRows = list.map((m: any) => ({
        "Major (EN)": m.name_en ?? "",
        "Major (AR)": m.name_ar ?? "",
        "Status": m.active ? "Active" : "Inactive",
      }));
    } else {
      exportRows = list.map((r: any) => ({
        "Name (EN)": r.name_en ?? "",
        "Name (AR)": r.name_ar ?? "",
        "Status": r.active ? "Active" : "Inactive",
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    const sheetName =
      kind === "departments" ? "Departments" :
      kind === "positions" ? "Positions" :
      kind === "job_grades" ? "Job Grades" :
      kind === "graduations" ? "Graduations" :
      kind === "majors" ? "Majors" : "Directory";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${kind}_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${exportRows.length} items`);
  }

  return (
    <div className="space-y-4">
      <Toolbar
        onTemplate={() => downloadTemplate(`${kind}_template.xlsx`, headers, [{ name_en: "Sales", name_ar: "المبيعات", active: true }])}
        onImport={handleImport}
        onExport={handleExport}
      />
      <div className={`grid gap-3 ${isDept ? "md:grid-cols-6" : "md:grid-cols-5"}`}>
        <div className="relative">
          <input
            className={inputCls}
            placeholder={isDept ? (nextCode ? `Code (${nextCode})` : "Code") : "Code"}
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            title={isDept ? "Department Code (auto-generated, editable)" : "Code"}
          />
          {isDept && nextCode && draft.code !== nextCode && (
            <button
              type="button"
              onClick={() => setDraft({ ...draft, code: nextCode })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-brand hover:underline font-semibold"
              title={`Set to next code: ${nextCode}`}
            >
              Auto
            </button>
          )}
        </div>
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
              code: draft.code || null,
              parent_id: draft.parent_id || null,
              reports_to_position_id: draft.reports_to_position_id || null,
              ...(isDept ? { responsible_person_id: draft.responsible_person_id || null } : {}),
            });
            setDraft({ name_en: "", name_ar: "", responsible_person_id: "", code: "", parent_id: "", reports_to_position_id: "" });
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      <Table
        cols={
          isDept
            ? [
                <button
                  key="code"
                  type="button"
                  onClick={toggleCodeSort}
                  className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition-colors group cursor-pointer"
                  title="Click to sort by Code"
                >
                  <span>Code</span>
                  {codeSort === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5 text-brand" />
                  ) : codeSort === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5 text-brand" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" />
                  )}
                </button>,
                "Name (EN)",
                "Name (AR)",
                "Sections",
                "Responsible",
                "Active",
                "",
              ]
            : [
                <button
                  key="code"
                  type="button"
                  onClick={toggleCodeSort}
                  className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition-colors group cursor-pointer"
                  title="Click to sort by Code"
                >
                  <span>Code</span>
                  {codeSort === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5 text-brand" />
                  ) : codeSort === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5 text-brand" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" />
                  )}
                </button>,
                "Name (EN)",
                "Name (AR)",
                "Reports To",
                "Active",
                "",
              ]
        }
      >
        {paged.slice.map((r: any) => editingId === r.id ? (
          <tr key={r.id} className="bg-brand/5">
            <td className="px-3 py-2">
              <input className={inputCls} placeholder="Code" value={editDraft.code} onChange={(e) => setEditDraft({ ...editDraft, code: e.target.value })} />
            </td>
            <td className="px-3 py-2">
              <input
                autoFocus
                className={inputCls}
                placeholder="Name (EN)"
                value={editDraft.name_en}
                onChange={(e) => setEditDraft({ ...editDraft, name_en: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit(r.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            </td>
            <td className="px-3 py-2">
              <input
                className={inputCls}
                placeholder="Name (AR)"
                value={editDraft.name_ar}
                onChange={(e) => setEditDraft({ ...editDraft, name_ar: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit(r.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            </td>
            {isDept ? (
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.sections_names || "—"}</td>
            ) : (
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.reports_to_name || "—"}</td>
            )}
            {isDept && (
              <td className="px-3 py-2">
                <select
                  className={inputCls}
                  value={editDraft.responsible_person_id}
                  onChange={(e) => setEditDraft({ ...editDraft, responsible_person_id: e.target.value })}
                >
                  <option value="">— Select Responsible —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                  {editDraft.responsible_person_id && !managers.find((m) => m.id === editDraft.responsible_person_id) && (
                    <option value={editDraft.responsible_person_id}>{r.responsible_person_name ?? "(unknown)"}</option>
                  )}
                </select>
              </td>
            )}
            <td className="px-3 py-2">
              <button
                type="button"
                onClick={() => setEditDraft({ ...editDraft, active: !editDraft.active })}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${editDraft.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
              >
                {editDraft.active ? "Yes" : "No"}
              </button>
            </td>
            <td className="px-3 py-2 text-end">
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSaveEdit(r.id)}
                  disabled={mUpsert.isPending}
                  className="rounded-lg p-1.5 text-brand bg-brand/10 hover:bg-brand/20 disabled:opacity-50"
                  title="Save changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        ) : (
          <tr key={r.id} className="hover:bg-muted/30">
            <td className="px-3 py-2 font-medium">{r.code || "—"}</td>
            <td className="px-3 py-2 font-medium">{r.name_en}</td>
            <td className="px-3 py-2">{r.name_ar || "—"}</td>
            {isDept ? (
              <td className="px-3 py-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSectionsDept(r)}
                  className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-muted/60 transition"
                  title="Manage sections for this department"
                >
                  <span className="text-foreground max-w-[200px] truncate">{r.sections_names || "—"}</span>
                  <span className="rounded-full bg-brand/10 text-brand px-1.5 py-0.5 text-[10px] font-semibold group-hover:bg-brand group-hover:text-brand-foreground transition">
                    {r.sub_sections_count ? `${r.sub_sections_count} sec` : "+ add"}
                  </span>
                </button>
              </td>
            ) : (
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.reports_to_name || "—"}</td>
            )}
            {isDept && (
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {r.responsible_person_name || "—"}
              </td>
            )}
            <td className="px-3 py-2">
              <button onClick={() => mUpsert.mutate({ id: r.id, name_en: r.name_en, name_ar: r.name_ar, active: !r.active })}
                className={`rounded-full px-2 py-1 text-xs ${r.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {r.active ? "Yes" : "No"}
              </button>
            </td>
            <td className="px-3 py-2 text-end">
              <div className="flex items-center justify-end gap-1.5">
                {isDept && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSectionsDept(r)}
                      className="rounded-lg bg-secondary/80 hover:bg-secondary text-foreground p-1.5 text-xs font-semibold px-2.5 transition"
                      title="Manage sections (e.g. a, b, c, d)"
                    >
                      Sections
                    </button>
                    <button
                      type="button"
                      onClick={() => setStructureDept(r)}
                      className="rounded-lg bg-brand/10 p-1.5 text-brand hover:bg-brand/20 text-xs font-semibold px-2.5"
                    >
                      Structure
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(r.id);
                    setEditDraft({
                      name_en: r.name_en ?? "",
                      name_ar: r.name_ar ?? "",
                      active: r.active ?? true,
                      responsible_person_id: r.responsible_person_id ?? "",
                      code: r.code ?? "",
                      parent_id: r.parent_id ?? "",
                      reports_to_position_id: r.reports_to_position_id ?? "",
                    });
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { if (confirm("Delete this item?")) mDel.mutate(r.id); }}
                  className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
        {q.isLoading && (
          <tr>
            <td colSpan={isDept ? 7 : 6} className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </td>
          </tr>
        )}
        {q.isError && (
          <tr>
            <td colSpan={isDept ? 7 : 6} className="p-8 text-center text-sm text-destructive">
              Failed to load: {(q.error as Error)?.message || "Unknown error"}
            </td>
          </tr>
        )}
        {!q.isLoading && !q.isError && paged.slice.length === 0 && (
          <tr>
            <td colSpan={isDept ? 7 : 6} className="p-8 text-center text-sm text-muted-foreground">
              No {kind.replace(/_/g, " ")} found.
            </td>
          </tr>
        )}
      </Table>
      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} />
      {structureDept && (
        <DepartmentStructureModal
          departmentId={structureDept.id}
          departmentName={structureDept.name_en}
          onClose={() => setStructureDept(null)}
        />
      )}
      {sectionsDept && (
        <DepartmentSectionsModal
          departmentId={sectionsDept.id}
          departmentName={sectionsDept.name_en}
          onClose={() => setSectionsDept(null)}
        />
      )}
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

  async function handleExport() {
    const citiesList: any[] = q.data ?? [];
    if (citiesList.length === 0) {
      toast.error("No cities or districts to export");
      return;
    }
    const XLSX = await import("xlsx");
    const exportRows: Record<string, any>[] = [];
    for (const c of citiesList) {
      const districts = c.districts ?? [];
      if (districts.length === 0) {
        exportRows.push({
          "City (EN)": c.name_en ?? "",
          "City (AR)": c.name_ar ?? "",
          "District (EN)": "",
          "District (AR)": "",
        });
      } else {
        for (const d of districts) {
          exportRows.push({
            "City (EN)": c.name_en ?? "",
            "City (AR)": c.name_ar ?? "",
            "District (EN)": d.name_en ?? "",
            "District (AR)": d.name_ar ?? "",
          });
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cities & Districts");
    XLSX.writeFile(wb, `cities_districts_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${exportRows.length} entries`);
  }

  return (
    <div className="space-y-4">
      <Toolbar
        onTemplate={() => downloadTemplate("cities_districts_template.xlsx",
          ["city_en", "city_ar", "district_en", "district_ar"],
          [{ city_en: "Cairo", city_ar: "القاهرة", district_en: "Maadi", district_ar: "المعادي" }])}
        onImport={handleImport}
        onExport={handleExport}
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
                    {d2.name_en} {d2.name_ar ? <span className="text-[10px] opacity-70">({d2.name_ar})</span> : null}
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



const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring";

function Table({ cols, children }: { cols: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>{cols.map((c, i) => <th key={i} className="px-3 py-2 text-start font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function Toolbar({ onTemplate, onImport, onExport }: { onTemplate: () => void; onImport: (f: File) => void; onExport?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={onTemplate} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm hover:bg-muted">
        <Download className="h-4 w-4" /> Download template
      </button>
      <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm cursor-pointer hover:bg-muted">
        <Upload className="h-4 w-4" /> Import from Excel
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
      </label>
      {onExport && (
        <button onClick={onExport} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm hover:bg-muted">
          <FileSpreadsheet className="h-4 w-4" /> Export Excel
        </button>
      )}
      <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5" /> .xlsx, .csv supported
      </span>
    </div>
  );
}