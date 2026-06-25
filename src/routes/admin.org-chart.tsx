import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Building2, Users, Briefcase, Search, ChevronDown, ChevronRight, Crown, Mail, Phone, ArrowUpRight, BadgeCheck, Pencil, Plus, Trash2, GripVertical, Check, X } from "lucide-react";
import {
  getOrgChart,
  renameDepartment, renamePosition,
  createDepartment, createPosition,
  deleteDepartment, deletePosition,
  reorderDepartments, reorderPositions,
  reassignEmployee,
  type OrgPerson, type OrgDept,
} from "@/backend/functions/org-chart.functions";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  useDroppable, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin/org-chart")({
  component: OrgChartPage,
});

function PersonCard({
  person,
  accent,
  title,
  deptName,
  onOpen,
  editing = false,
}: {
  person: OrgPerson;
  accent?: "primary" | "head" | "ghost";
  title?: string;
  deptName?: string;
  onOpen: (p: OrgPerson, ctx: { title?: string; deptName?: string }) => void;
  editing?: boolean;
}) {
  const sortable = useSortable({ id: `person:${person.id}`, data: { type: "person", personId: person.id }, disabled: !editing });
  const style = editing ? {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  } : undefined;
  const isPrimary = accent === "primary";
  const isHead = accent === "head";
  const tone = isPrimary
    ? "border-brand/40 bg-gradient-to-br from-brand/10 via-card to-card shadow-[0_8px_24px_-12px_hsl(var(--brand)/0.45)]"
    : isHead
    ? "border-brand/20 bg-gradient-to-br from-brand/[0.04] via-card to-card"
    : "border-border/70 bg-card";
  const stripe = isPrimary
    ? "bg-gradient-to-r from-brand via-brand/70 to-brand/30"
    : isHead
    ? "bg-gradient-to-r from-brand/60 via-brand/30 to-transparent"
    : "bg-gradient-to-r from-border via-border/60 to-transparent";
  const displayTitle = title ?? person.positionName ?? "Team Member";
  return (
    <div
      ref={editing ? sortable.setNodeRef : undefined}
      style={style}
      className={`group relative flex w-64 flex-col overflow-hidden rounded-2xl border ${tone} backdrop-blur-sm transition-all duration-300 ${editing ? "cursor-grab active:cursor-grabbing" : "hover:-translate-y-1 hover:border-brand/50 hover:shadow-[0_16px_40px_-16px_hsl(var(--brand)/0.4)]"}`}
      onClick={() => !editing && onOpen(person, { title, deptName })}
      role={editing ? undefined : "button"}
      {...(editing ? sortable.attributes : {})}
      {...(editing ? sortable.listeners : {})}
    >
      {/* Accent stripe */}
      <div className={`h-1 w-full ${stripe}`} />

      {/* Lead badge */}
      {isPrimary && (
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-foreground shadow-md">
          <Crown className="h-2.5 w-2.5" /> Lead
        </span>
      )}
      {editing && (
        <span className="absolute left-2 top-2 z-10 rounded-md bg-background/80 p-1 text-muted-foreground shadow-sm">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}

      <div className="flex flex-col items-center gap-3 px-4 pb-3 pt-5">
        {/* Avatar with status dot */}
        <div className="relative">
          <div className={`absolute -inset-1 rounded-full ${isPrimary ? "bg-gradient-to-tr from-brand/40 to-brand/10" : isHead ? "bg-gradient-to-tr from-brand/20 to-transparent" : ""}`} />
          <EmployeeAvatar
            id={person.id}
            name={person.name}
            url={person.avatarUrl}
            className="relative h-16 w-16 ring-2 ring-background shadow-lg"
          />
          <span className="absolute bottom-0.5 right-0.5 block h-3 w-3 rounded-full border-2 border-card bg-emerald-500 shadow-sm" />
        </div>

        {/* Name + title */}
        <div className="min-w-0 w-full text-center">
          <div className="truncate text-sm font-semibold tracking-tight text-foreground" title={person.name}>
            {person.name}
          </div>
          <div
            className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground"
            title={displayTitle}
          >
            {displayTitle}
          </div>
          {deptName && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-2.5 w-2.5" />
              <span className="truncate max-w-[140px]">{deptName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Contact footer */}
      <div className="mt-auto border-t border-border/60 bg-muted/20 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 flex-col gap-0.5">
            {person.email && (
              <span className="flex min-w-0 items-center gap-1.5" title={person.email}>
                <Mail className="h-3 w-3 shrink-0 text-brand/70" />
                <span className="truncate">{person.email}</span>
              </span>
            )}
            {person.phone && (
              <span className="flex min-w-0 items-center gap-1.5" title={person.phone}>
                <Phone className="h-3 w-3 shrink-0 text-brand/70" />
                <span className="truncate">{person.phone}</span>
              </span>
            )}
            {!person.email && !person.phone && (
              <span className="text-muted-foreground/60 italic">No contact info</span>
            )}
          </div>
          {!editing && (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-hover:text-brand" />
          )}
        </div>
      </div>
    </div>
  );
}

function DeptNode({
  dept,
  query,
  onOpen,
  editing,
  onRename,
  onDelete,
  onRenamePosition,
  onDeletePosition,
  onAddPosition,
}: {
  dept: OrgDept;
  query: string;
  onOpen: (p: OrgPerson, ctx: { title?: string; deptName?: string }) => void;
  editing: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onRenamePosition: (id: string, name: string) => void;
  onDeletePosition: (id: string) => void;
  onAddPosition: (deptId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const sortable = useSortable({ id: `dept:${dept.id}`, data: { type: "dept" }, disabled: !editing });
  const style = editing ? {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  } : undefined;
  const deptDrop = useDroppable({ id: `dept-drop:${dept.id}`, data: { type: "dept-drop", deptId: dept.id, positionId: null }, disabled: !editing });
  const q = query.trim().toLowerCase();
  const match = (p: OrgPerson) =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    (p.email ?? "").toLowerCase().includes(q) ||
    (p.positionName ?? "").toLowerCase().includes(q);

  const filteredPositions = dept.positions
    .map((pg) => ({ ...pg, people: pg.people.filter(match) }))
    .filter((pg) => pg.people.length > 0 || !q);
  const filteredUnassigned = dept.unassigned.filter(match);
  const headVisible = dept.head ? match(dept.head) : false;

  const visibleCount =
    (headVisible ? 1 : 0) +
    filteredPositions.reduce((a, b) => a + b.people.length, 0) +
    filteredUnassigned.length;

  if (q && visibleCount === 0) return null;

  return (
    <section
      ref={editing ? sortable.setNodeRef : undefined}
      style={style}
      className={`rounded-3xl border border-border bg-gradient-to-b from-muted/40 to-card p-5 shadow-sm ${editing && deptDrop.isOver ? "ring-2 ring-brand" : ""}`}
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        {editing && (
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground"
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label="Drag department"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-brand">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            {editing ? (
              <InlineRename value={dept.name} onSave={(v) => onRename(dept.id, v)} className="text-lg font-black" />
            ) : (
              <h3 className="truncate text-lg font-black text-foreground">{dept.name}</h3>
            )}
            <p className="text-xs font-medium text-muted-foreground">
              {dept.total} {dept.total === 1 ? "member" : "members"} · {dept.positions.length} positions
            </p>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {visibleCount}/{dept.total}
          </span>
          {editing && (
            <button
              type="button"
              onClick={() => onDelete(dept.id)}
              className="rounded-full border border-border bg-card p-1.5 text-destructive hover:bg-destructive/10"
              aria-label="Delete department"
              title="Delete department (must be empty)"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {open ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
        </div>
      </header>

      {open && (
        <div ref={editing ? deptDrop.setNodeRef : undefined} className="mt-5 space-y-6">
          {dept.head && headVisible && (
            <div className="flex flex-col items-center gap-4">
              <PersonCard
                person={dept.head}
                accent="primary"
                title={dept.head.positionName ?? "Department Lead"}
                deptName={dept.name}
                onOpen={onOpen}
                editing={editing}
              />
              {(filteredPositions.length > 0 || filteredUnassigned.length > 0) && (
                <div className="h-6 w-px bg-border" />
              )}
            </div>
          )}
          <SortableContext items={filteredPositions.map((p) => `pos:${p.id}`)} strategy={verticalListSortingStrategy}>
            {filteredPositions.map((pg) => (
              <PositionGroup
                key={pg.id}
                deptId={dept.id}
                deptName={dept.name}
                pg={pg}
                editing={editing}
                onOpen={onOpen}
                onRename={onRenamePosition}
                onDelete={onDeletePosition}
              />
            ))}
          </SortableContext>
          {editing && (
            <button
              type="button"
              onClick={() => onAddPosition(dept.id)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 p-3 text-xs font-semibold text-muted-foreground hover:bg-background"
            >
              <Plus className="h-4 w-4" /> Add position
            </button>
          )}
          {filteredUnassigned.length > 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-bold text-foreground">Unassigned position</h4>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {filteredUnassigned.length}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
                {filteredUnassigned.map((p) => (
                  <PersonCard key={p.id} person={p} accent="ghost" deptName={dept.name} onOpen={onOpen} editing={editing} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PositionGroup({
  deptId,
  deptName,
  pg,
  editing,
  onOpen,
  onRename,
  onDelete,
}: {
  deptId: string;
  deptName: string;
  pg: { id: string; name: string; people: OrgPerson[] };
  editing: boolean;
  onOpen: (p: OrgPerson, ctx: { title?: string; deptName?: string }) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const sortable = useSortable({ id: `pos:${pg.id}`, data: { type: "pos" }, disabled: !editing });
  const drop = useDroppable({ id: `pos-drop:${pg.id}`, data: { type: "pos-drop", deptId, positionId: pg.id }, disabled: !editing });
  const style = editing ? {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  } : undefined;
  return (
    <div
      ref={editing ? sortable.setNodeRef : undefined}
      style={style}
      className={`rounded-2xl border border-dashed border-border bg-background/60 p-4 ${editing && drop.isOver ? "ring-2 ring-brand" : ""}`}
    >
      <div ref={editing ? drop.setNodeRef : undefined} className="mb-3 flex items-center gap-2">
        {editing && (
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground"
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label="Drag position"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Briefcase className="h-4 w-4 text-brand" />
        {editing ? (
          <InlineRename value={pg.name} onSave={(v) => onRename(pg.id, v)} className="text-sm font-bold" />
        ) : (
          <h4 className="text-sm font-bold text-foreground">{pg.name}</h4>
        )}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {pg.people.length}
        </span>
        {editing && (
          <button
            type="button"
            onClick={() => onDelete(pg.id)}
            className="ml-auto rounded-full border border-border bg-card p-1 text-destructive hover:bg-destructive/10"
            aria-label="Delete position"
            title="Delete position (must be empty)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
        {pg.people.map((p) => (
          <PersonCard key={p.id} person={p} accent="head" deptName={deptName} onOpen={onOpen} editing={editing} />
        ))}
        {pg.people.length === 0 && editing && (
          <p className="text-xs text-muted-foreground">Drop an employee here to assign this position.</p>
        )}
      </div>
    </div>
  );
}

function InlineRename({
  value,
  onSave,
  className,
}: { value: string; onSave: (next: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setV(value); setEditing(true); }}
        className={`group inline-flex items-center gap-1 truncate text-foreground hover:text-brand ${className ?? ""}`}
      >
        <span className="truncate">{value}</span>
        <Pencil className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(v); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-7 w-48"
      />
      <button type="button" onClick={() => { onSave(v); setEditing(false); }} className="rounded p-1 text-emerald-600 hover:bg-emerald-500/10"><Check className="h-4 w-4" /></button>
      <button type="button" onClick={() => setEditing(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
    </span>
  );
}

function OrgChartPage() {
  const fetchChart = useServerFn(getOrgChart);
  const renameDeptFn = useServerFn(renameDepartment);
  const renamePosFn = useServerFn(renamePosition);
  const createDeptFn = useServerFn(createDepartment);
  const createPosFn = useServerFn(createPosition);
  const deleteDeptFn = useServerFn(deleteDepartment);
  const deletePosFn = useServerFn(deletePosition);
  const reorderDeptsFn = useServerFn(reorderDepartments);
  const reorderPosFn = useServerFn(reorderPositions);
  const reassignFn = useServerFn(reassignEmployee);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["org-chart"],
    queryFn: () => fetchChart(),
  });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<
    null | { person: OrgPerson; title?: string; deptName?: string }
  >(null);
  const openPerson = (person: OrgPerson, ctx: { title?: string; deptName?: string }) =>
    setSelected({ person, ...ctx });

  const stats = data?.totals;
  const visibleDepartments = useMemo(() => data?.departments ?? [], [data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["org-chart"] });

  const handle = async <T,>(label: string, p: Promise<T>) => {
    try { await p; toast.success(label); refresh(); }
    catch (e) { toast.error((e as Error).message ?? "Failed"); }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const aType = (active.data.current as any)?.type as string | undefined;
    const oType = (over.data.current as any)?.type as string | undefined;

    if (aType === "dept" && oType === "dept") {
      const ids = visibleDepartments.map((d) => `dept:${d.id}`);
      const from = ids.indexOf(active.id as string);
      const to = ids.indexOf(over.id as string);
      if (from < 0 || to < 0) return;
      const next = arrayMove(visibleDepartments, from, to).map((d) => d.id);
      handle("Departments reordered", reorderDeptsFn({ data: { orderedIds: next } }));
      return;
    }
    if (aType === "pos" && oType === "pos") {
      // Reorder within same dept only (positions are global, but we surface dept-scoped order)
      const dept = visibleDepartments.find((d) => d.positions.some((p) => `pos:${p.id}` === active.id));
      if (!dept) return;
      const ids = dept.positions.map((p) => `pos:${p.id}`);
      const from = ids.indexOf(active.id as string);
      const to = ids.indexOf(over.id as string);
      if (from < 0 || to < 0) return;
      // Build a full global ordering: keep all positions, but reorder this dept's slice
      const allPositions: string[] = [];
      for (const d of visibleDepartments) for (const p of d.positions) allPositions.push(p.id);
      const reorderedDept = arrayMove(dept.positions.map((p) => p.id), from, to);
      const result: string[] = [];
      let i = 0;
      for (const pid of allPositions) {
        if (dept.positions.some((p) => p.id === pid)) {
          result.push(reorderedDept[i++]);
        } else {
          result.push(pid);
        }
      }
      handle("Positions reordered", reorderPosFn({ data: { orderedIds: result } }));
      return;
    }
    if (aType === "person") {
      const personId = (active.data.current as any).personId as string;
      if (oType === "pos-drop") {
        const { deptId, positionId } = over.data.current as any;
        handle("Employee reassigned", reassignFn({ data: { employeeId: personId, departmentId: deptId, positionId } }));
      } else if (oType === "dept-drop") {
        const { deptId } = over.data.current as any;
        handle("Employee moved", reassignFn({ data: { employeeId: personId, departmentId: deptId, positionId: null } }));
      }
    }
  };

  const promptAddDept = async () => {
    const name = window.prompt("New department name");
    if (!name) return;
    handle("Department created", createDeptFn({ data: { name } }));
  };
  const promptAddPos = async (_deptId: string) => {
    const name = window.prompt("New position name");
    if (!name) return;
    handle("Position created", createPosFn({ data: { name } }));
  };
  const confirmDeleteDept = (id: string) => {
    if (!window.confirm("Delete this department? It must be empty.")) return;
    handle("Department deleted", deleteDeptFn({ data: { id } }));
  };
  const confirmDeletePos = (id: string) => {
    if (!window.confirm("Delete this position? It must be empty.")) return;
    handle("Position deleted", deletePosFn({ data: { id } }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black text-foreground sm:text-3xl">Manpower Org Chart</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {editing
              ? "Edit mode: rename, drag to reorder, drop employees onto positions or departments."
              : "Departments, positions, and the people responsible for each role."}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, role…"
              className="pl-9"
              disabled={editing}
            />
          </div>
          <Button
            variant={editing ? "default" : "outline"}
            onClick={() => { setEditing((v) => !v); setQ(""); }}
          >
            <Pencil className="h-4 w-4" /> {editing ? "Done" : "Edit"}
          </Button>
          {editing && (
            <Button variant="outline" onClick={promptAddDept}>
              <Plus className="h-4 w-4" /> Department
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Users, label: "Employees", value: stats?.employees ?? "—" },
          { icon: Building2, label: "Departments", value: stats?.departments ?? "—" },
          { icon: Briefcase, label: "Positions", value: stats?.positions ?? "—" },
          { icon: Crown, label: "Leadership", value: data?.ceo ? 1 : 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</div>
                <div className="text-xl font-black text-foreground">{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading organization chart…
        </div>
      )}

      {data?.ceo && (
        <section className="rounded-3xl border border-border bg-gradient-to-b from-brand/10 to-card p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-foreground">
              <Crown className="h-3 w-3" /> Top of organization
            </span>
            <PersonCard
              person={data.ceo}
              accent="primary"
              title={data.ceo.positionName ?? "General Manager"}
              deptName="Executive"
              onOpen={openPerson}
              editing={editing}
            />
          </div>
        </section>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={visibleDepartments.map((d) => `dept:${d.id}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {visibleDepartments.map((d) => (
              <DeptNode
                key={d.id}
                dept={d}
                query={q}
                onOpen={openPerson}
                editing={editing}
                onRename={(id, name) => handle("Department renamed", renameDeptFn({ data: { id, name } }))}
                onDelete={confirmDeleteDept}
                onRenamePosition={(id, name) => handle("Position renamed", renamePosFn({ data: { id, name } }))}
                onDeletePosition={confirmDeletePos}
                onAddPosition={promptAddPos}
              />
            ))}
            {!isLoading && visibleDepartments.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                No departments yet. Create them in <Link to="/admin/directory" className="font-semibold text-brand underline">Directory</Link>.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <PersonDialog
        entry={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function PersonDialog({
  entry,
  onOpenChange,
}: {
  entry: { person: OrgPerson; title?: string; deptName?: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const p = entry?.person;
  const status = p?.status ?? "Active";
  const statusTone =
    status === "Active"
      ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
      : status === "Inactive"
      ? "bg-muted text-muted-foreground ring-border"
      : "bg-amber-500/10 text-amber-600 ring-amber-500/20";
  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {p && (
          <>
            <div className="bg-gradient-to-br from-brand/20 via-brand/5 to-card px-6 pb-5 pt-6">
              <DialogHeader>
                <DialogTitle className="sr-only">{p.name}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-4">
                <EmployeeAvatar
                  id={p.id}
                  name={p.name}
                  url={p.avatarUrl}
                  className="h-16 w-16 shrink-0 ring-4 ring-background shadow-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-black text-foreground">{p.name}</div>
                  <div className="truncate text-sm font-medium text-muted-foreground">
                    {entry?.title ?? p.positionName ?? "—"}
                  </div>
                  <span
                    className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusTone}`}
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {status}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-3 px-6 py-5">
              <DetailRow icon={Building2} label="Department" value={entry?.deptName ?? "—"} />
              <DetailRow icon={Briefcase} label="Position" value={p.positionName ?? "—"} />
              <DetailRow
                icon={Mail}
                label="Email"
                value={p.email ?? "—"}
                href={p.email ? `mailto:${p.email}` : undefined}
              />
              <DetailRow
                icon={Phone}
                label="Phone"
                value={p.phone ?? "—"}
                href={p.phone ? `tel:${p.phone}` : undefined}
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3">
              <Link
                to="/admin/employees/$id"
                params={{ id: p.id }}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-brand-foreground shadow-brand transition hover:opacity-90"
              >
                View full profile <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <span className="truncate text-sm font-semibold text-foreground" title={value}>
      {value}
    </span>
  );
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        {href ? (
          <a href={href} className="block truncate text-sm font-semibold text-brand hover:underline" title={value}>
            {value}
          </a>
        ) : (
          inner
        )}
      </div>
    </div>
  );
}