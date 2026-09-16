import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Search, MoreHorizontal, Bell, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  listContractNotificationsAdmin,
  getContractNotificationStatsAdmin,
  setNotificationActionAdmin,
  notifyEmployeeAdmin,
  confirmNotificationAdmin,
  closeNotificationAdmin,
  type ContractNotificationRow,
} from "@/backend/functions/contract-notifications.functions";
import { formatDate } from "@/lib/date-format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/contracts/notifications")({
  component: ContractNotificationsPage,
});

type FilterKey = "all" | "15" | "30" | "65" | "renew" | "resign" | "pending" | "notified" | "confirmed" | "closed";

function StatCard({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colorClass}`}>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function ContractNotificationsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const listFn = useServerFn(listContractNotificationsAdmin);
  const statsFn = useServerFn(getContractNotificationStatsAdmin);

  const queryKey = ["admin", "contract-notifications", { q: qDebounced, filter, page, pageSize }] as const;
  
  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { q: qDebounced, filter, page, pageSize } }),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin", "contract-notifications", "stats"],
    queryFn: () => statsFn(),
  });

  const rows = data?.rows ?? [];
  
  // Action Modals State
  const [actionItem, setActionItem] = useState<{ item: ContractNotificationRow, action: string } | null>(null);
  const [notes, setNotes] = useState("");

  const setActionMut = useMutation({
    mutationFn: (vars: { id: string; type: "renew" | "resign"; notes?: string }) => setNotificationActionAdmin({ data: vars }),
    onSuccess: () => { toast.success("Action recorded"); setActionItem(null); qc.invalidateQueries({ queryKey: ["admin", "contract-notifications"] }); },
    onError: (e: any) => toast.error("Error", { description: e.message })
  });

  const notifyMut = useMutation({
    mutationFn: (id: string) => notifyEmployeeAdmin({ data: { id } }),
    onSuccess: () => { toast.success("Employee notified"); setActionItem(null); qc.invalidateQueries({ queryKey: ["admin", "contract-notifications"] }); },
    onError: (e: any) => toast.error("Error", { description: e.message })
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => confirmNotificationAdmin({ data: { id } }),
    onSuccess: () => { toast.success("Notification confirmed"); setActionItem(null); qc.invalidateQueries({ queryKey: ["admin", "contract-notifications"] }); },
    onError: (e: any) => toast.error("Error", { description: e.message })
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => closeNotificationAdmin({ data: { id } }),
    onSuccess: () => { toast.success("Notification closed"); setActionItem(null); qc.invalidateQueries({ queryKey: ["admin", "contract-notifications"] }); },
    onError: (e: any) => toast.error("Error", { description: e.message })
  });

  const handleAction = () => {
    if (!actionItem) return;
    const { item, action } = actionItem;
    if (action === "renew" || action === "resign") {
      setActionMut.mutate({ id: item.id, type: action as any, notes });
    } else if (action === "notify") {
      notifyMut.mutate(item.id);
    } else if (action === "confirm") {
      confirmMut.mutate(item.id);
    } else if (action === "close") {
      closeMut.mutate(item.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Expiring (65d)" value={stats?.total ?? 0} colorClass="bg-card border-border" />
        <StatCard label="Within 15 Days" value={stats?.within15 ?? 0} colorClass="bg-red-50 border-red-100 text-red-900 dark:bg-red-950/20 dark:border-red-900" />
        <StatCard label="Within 30 Days" value={stats?.within30 ?? 0} colorClass="bg-amber-50 border-amber-100 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900" />
        <StatCard label="Intent: Renew" value={stats?.renew ?? 0} colorClass="bg-green-50 border-green-100 text-green-900 dark:bg-green-950/20 dark:border-green-900" />
        <StatCard label="Intent: Resign" value={stats?.resign ?? 0} colorClass="bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search employee..."
            className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "15", "30", "65", "renew", "resign", "pending", "notified", "confirmed", "closed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as FilterKey)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
                filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "15" ? "≤ 15 Days" : f === "30" ? "≤ 30 Days" : f === "65" ? "≤ 65 Days" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Contract End</TableHead>
                <TableHead>Days Left</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.employee_name}</div>
                    <div className="text-xs text-muted-foreground">{r.employee_code}</div>
                  </TableCell>
                  <TableCell>{formatDate(r.contract_end_date)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.days_remaining <= 15 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                      r.days_remaining <= 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}>
                      {r.days_remaining}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`capitalize font-semibold ${r.type === 'renew' ? 'text-green-600' : 'text-slate-500'}`}>
                      {r.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize text-xs rounded border px-2 py-0.5">{r.status}</span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setActionItem({ item: r, action: "renew" }); setNotes(r.notes || ""); }}>Set as Renew</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActionItem({ item: r, action: "resign" }); setNotes(r.notes || ""); }}>Set as Resign</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActionItem({ item: r, action: "notify" })} disabled={r.status !== "pending"}>Notify Employee</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActionItem({ item: r, action: "confirm" })} disabled={r.status !== "notified"}>Confirm</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActionItem({ item: r, action: "close" })} disabled={r.status === "closed"}>Close</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !isFetching && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No active employee contracts expiring in this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!actionItem && ["notify", "confirm", "close"].includes(actionItem.action)} onOpenChange={(o) => !o && setActionItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="capitalize">{actionItem?.action} Notification</AlertDialogTitle>
            <AlertDialogDescription>
              {actionItem?.action === "notify" && "Are you sure you want to notify the employee? An email will be sent containing the company's intention regarding their contract."}
              {actionItem?.action === "confirm" && "Confirming means HR has officially reviewed and approved this notification."}
              {actionItem?.action === "close" && "Closing this notification marks the process as completed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!actionItem && ["renew", "resign"].includes(actionItem.action)} onOpenChange={(o) => !o && setActionItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionItem?.action === "renew" ? "Confirm Contract Renewal Intent" : "Confirm Non-Renewal Intent"}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground space-y-4">
            <p>
              {actionItem?.action === "renew" 
                ? "The company intends to continue the employee's employment, subject to the official renewal process."
                : "The employee may need to be informed in advance so they have sufficient time to make future employment plans. This does NOT automatically terminate them."}
            </p>
            <div className="space-y-2">
              <label className="font-semibold text-foreground">Notes (Optional)</label>
              <textarea 
                className="w-full min-h-[100px] p-2 rounded border border-border bg-background"
                placeholder="Internal HR notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <button className="px-4 py-2 text-sm font-semibold hover:bg-muted rounded" onClick={() => setActionItem(null)}>Cancel</button>
            <button className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded" onClick={handleAction}>Save Action</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
