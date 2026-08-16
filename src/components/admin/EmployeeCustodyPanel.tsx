import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Package, Trash2, Loader2, X, CornerDownLeft, Pencil, Filter, History } from "lucide-react";
import { getMe } from "@/backend/functions/auth.functions";
import {
  listEmployeeCustody,
  addEmployeeCustody,
  deleteEmployeeCustody,
  updateEmployeeCustody,
  returnEmployeeCustody,
  CUSTODY_CATEGORIES,
  type CustodyItem,
} from "@/backend/functions/custody.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (dateString?: string | null) => {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
};

export function EmployeeCustodyPanel({ employeeId }: { employeeId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listEmployeeCustody);
  const addFn = useServerFn(addEmployeeCustody);
  const delFn = useServerFn(deleteEmployeeCustody);
  const updFn = useServerFn(updateEmployeeCustody);
  const retFn = useServerFn(returnEmployeeCustody);
  const meFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me", "roles"], queryFn: () => meFn(), staleTime: 60_000 });
  const currentUserName =
    ((me?.profile as any)?.full_name as string | undefined)?.trim() ||
    ((me?.profile as any)?.email as string | undefined)?.trim() ||
    "";

  const [openAdd, setOpenAdd] = useState(false);
  const [editItem, setEditItem] = useState<CustodyItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<CustodyItem | null>(null);
  const [returnItem, setReturnItem] = useState<CustodyItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", category: "", model: "" });

  const q = useQuery({
    queryKey: ["employee-custody", employeeId],
    queryFn: () => listFn({ data: { profileId: employeeId } }),
  });

  const addMut = useMutation({
    mutationFn: (v: any) => addFn({ data: { profileId: employeeId, ...v } }),
    onSuccess: () => {
      toast.success(t("addCustodyItem" as any));
      setOpenAdd(false);
      qc.invalidateQueries({ queryKey: ["employee-custody", employeeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      setDeleteItem(null);
      qc.invalidateQueries({ queryKey: ["employee-custody", employeeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const updMut = useMutation({
    mutationFn: (v: any) => updFn({ data: { id: editItem!.id, ...v } }),
    onSuccess: () => {
      toast.success(t("save" as any));
      setEditItem(null);
      qc.invalidateQueries({ queryKey: ["employee-custody", employeeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });

  const retMut = useMutation({
    mutationFn: (v: any) => retFn({ data: { id: returnItem!.id, ...v } }),
    onSuccess: () => {
      toast.success(t("custodyReturnSuccess" as any));
      setReturnItem(null);
      qc.invalidateQueries({ queryKey: ["employee-custody", employeeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to return custody"),
  });

  const allItems = (q.data ?? []) as CustodyItem[];
  const items = useMemo(
    () =>
      allItems.filter((it) => {
        if (filters.from && (it.custody_date ?? "") < filters.from) return false;
        if (filters.to && (it.custody_date ?? "") > filters.to) return false;
        if (filters.category && it.category !== filters.category) return false;
        if (filters.model && !(it.model ?? "").toLowerCase().includes(filters.model.toLowerCase())) return false;
        return true;
      }),
    [allItems, filters],
  );
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const returnedItems = useMemo(
    () =>
      items
        .filter((it) => !!it.return_date)
        .sort((a, b) => String(b.return_date).localeCompare(String(a.return_date))),
    [items],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("custody" as any)}</h2>
          <p className="text-sm text-muted-foreground">{t("custodySubtitle" as any)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Filter className="h-4 w-4" /> {t("filters" as any) ?? "Filters"}
            {activeFilters > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilters}</span>
            )}
          </button>
          <button
            onClick={() => setOpenAdd(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand"
          >
            <Plus className="h-4 w-4" /> {t("addCustody" as any)}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("from" as any) ?? "From"}</span>
            <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className={inputCls} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("to" as any) ?? "To"}</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className={inputCls} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("custodyCategory" as any)}</span>
            <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
              <option value="">—</option>
              {CUSTODY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`cat.${c}` as any) ?? c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("custodyModel" as any)}</span>
            <input value={filters.model} onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))} className={inputCls} />
          </label>
          <div className="sm:col-span-4 flex justify-end">
            <button
              onClick={() => setFilters({ from: "", to: "", category: "", model: "" })}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              {t("clear" as any) ?? "Clear"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {q.isLoading ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Package className="h-6 w-6" />
            {t("noCustodyItems" as any)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t("custodyDate" as any)}</th>
                  <th className="px-4 py-3 text-start">{t("custodyName" as any)}</th>
                  <th className="px-4 py-3 text-start">{t("custodySerial" as any)}</th>
                  <th className="px-4 py-3 text-start">{t("custodyCategory" as any)}</th>
                  <th className="px-4 py-3 text-start">{t("status" as any)}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((it) => {
                  const isReturned = !!it.return_date;
                  return (
                    <tr key={it.id} className={`hover:bg-muted/30 ${isReturned ? "opacity-60 grayscale-[0.5]" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs">{formatDate(it.custody_date)}</td>
                      <td className="px-4 py-3 font-medium">
                        {it.name}
                        {it.model && <div className="text-[11px] text-muted-foreground">{it.model}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{it.serial_number ?? "—"}</td>
                      <td className="px-4 py-3">
                        {it.category ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                            {t(`cat.${it.category}` as any) ?? it.category}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isReturned ? (
                          <div>
                            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success uppercase">
                              {t("statusReturned" as any)}
                            </span>
                            <div className="mt-1 text-[11px] font-mono text-muted-foreground">{formatDate(it.return_date)}</div>
                            {it.returned_by && (
                              <div className="mt-0.5 text-[11px] text-muted-foreground">
                                {t("returnedBy" as any)}: {it.returned_by}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                            {t("statusActive" as any)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          {!isReturned && (
                            <button
                              onClick={() => setReturnItem(it)}
                              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title={t("returnCustody" as any)}
                            >
                              <CornerDownLeft className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setEditItem(it)}
                            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title={t("edit" as any)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            disabled={delMut.isPending}
                            onClick={() => setDeleteItem(it)}
                            className="rounded-full p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            title={t("delete" as any)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("custodyReturnHistory" as any) ?? "Return history"}</h3>
        </div>
        {returnedItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("noReturnedCustody" as any) ?? "No returned items yet"}
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {returnedItems.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{it.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t("returnedBy" as any) ?? "Returned by"}: <span className="font-semibold text-foreground">{it.returned_by ?? "—"}</span>
                  {" • "}
                  {t("returnDate" as any) ?? "Return date"}: <span className="font-semibold text-foreground">{formatDate(it.return_date)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {openAdd && <CustodyFormModal onClose={() => setOpenAdd(false)} onSubmit={(v) => addMut.mutate(v)} pending={addMut.isPending} />}
      {editItem && (
        <CustodyFormModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSubmit={(v) => updMut.mutate(v)}
          pending={updMut.isPending}
        />
      )}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete" as any)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeCustodyConfirm" as any)} {deleteItem ? `— ${deleteItem.name}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteItem) delMut.mutate(deleteItem.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete" as any)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {returnItem && (
        <ReturnCustodyModal
          item={returnItem}
          defaultReturnedBy={currentUserName}
          onClose={() => setReturnItem(null)}
          onSubmit={(v) => retMut.mutate(v)}
          pending={retMut.isPending}
        />
      )}
    </div>
  );
}

function CustodyFormModal({
  item,
  onClose,
  onSubmit,
  pending,
}: {
  item?: CustodyItem;
  onClose: () => void;
  onSubmit: (v: any) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    custody_date: item?.custody_date ?? today(),
    name: item?.name ?? "",
    serial_number: item?.serial_number ?? "",
    model: item?.model ?? "",
    category: item?.category ?? "",
    notes: item?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const upd = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.custody_date) e.custody_date = t("required" as any) ?? "Required";
    if (!form.name.trim()) e.name = t("required" as any) ?? "Required";
    else if (form.name.trim().length > 200) e.name = "Max 200 characters";
    if (form.serial_number.length > 120) e.serial_number = "Max 120 characters";
    if (form.model.length > 120) e.model = "Max 120 characters";
    if (form.notes.length > 2000) e.notes = "Max 2000 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">
            {item ? t("edit" as any) : t("addCustodyItem" as any)}
          </h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validate()) return;
            onSubmit({ ...form, name: form.name.trim() });
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("custodyDate" as any)}</span>
            <input type="date" value={form.custody_date} onChange={(e) => upd("custody_date", e.target.value)} className={inputCls} />
            {errors.custody_date && <p className="text-xs text-destructive">{errors.custody_date}</p>}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("custodyName" as any)}</span>
            <input value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder={t("custodyNamePlaceholder" as any)} className={inputCls} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("custodySerial" as any)}</span>
            <input value={form.serial_number} onChange={(e) => upd("serial_number", e.target.value)} className={inputCls + " font-mono"} />
            {errors.serial_number && <p className="text-xs text-destructive">{errors.serial_number}</p>}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("custodyModel" as any)}</span>
            <input value={form.model} onChange={(e) => upd("model", e.target.value)} className={inputCls} />
            {errors.model && <p className="text-xs text-destructive">{errors.model}</p>}
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">{t("custodyCategory" as any)}</span>
            <select value={form.category} onChange={(e) => upd("category", e.target.value)} className={inputCls}>
              <option value="">—</option>
              {CUSTODY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`cat.${c}` as any) ?? c}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">{t("custodyNotes" as any)}</span>
            <textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={2} className={inputCls} />
          </label>
          <div className="sm:col-span-2 mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReturnCustodyModal({
  item,
  defaultReturnedBy,
  onClose,
  onSubmit,
  pending,
}: {
  item: CustodyItem;
  defaultReturnedBy?: string;
  onClose: () => void;
  onSubmit: (v: any) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [returnedBy, setReturnedBy] = useState(defaultReturnedBy ?? "");
  const [err, setErr] = useState<string | null>(null);
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current && defaultReturnedBy) setReturnedBy(defaultReturnedBy);
  }, [defaultReturnedBy]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{t("returnCustody" as any)}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm font-medium">{item.name}</p>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!returnedBy.trim()) {
              setErr(t("returnedByRequired" as any) || "Returned by is required");
              return;
            }
            setErr(null);
            onSubmit({ return_date: date, returned_by: returnedBy.trim(), return_notes: notes });
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("returnDate" as any)}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("returnedBy" as any)}</span>
            <input
              value={returnedBy}
              onChange={(e) => {
                touched.current = true;
                setReturnedBy(e.target.value);
                if (err) setErr(null);
              }}
              maxLength={200}
              className={inputCls}
              required
            />
            {err && <span className="text-[11px] font-semibold text-destructive">{err}</span>}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">{t("returnNotes" as any)}</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-semibold text-success-foreground disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} {t("markAsReturned" as any)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
