import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Send, CheckCircle2, XCircle, Clock, RefreshCw, Phone, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import {
  listEmployeesWithWelcomeSmsStatus,
  sendEmployeeWelcomeSms,
  getSmsConfig,
} from "@/backend/functions/sms.functions";

type SmsEmployeeRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  normalizedPhone: string | null;
  emp_code: string | null;
  avatar_url: string | null;
  status: string;
  smsStatus: "sent" | "failed" | "not_sent";
  lastSentAt: string | null;
  lastError: string | null;
  lastSmsId: string | null;
};

export function SmsBroadcastTab() {
  const { t, dir } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "sent" | "failed" | "not_sent">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalEmployee, setModalEmployee] = useState<SmsEmployeeRow | null>(null);

  const listFn = useServerFn(listEmployeesWithWelcomeSmsStatus);
  const sendFn = useServerFn(sendEmployeeWelcomeSms);
  const cfgFn = useServerFn(getSmsConfig);

  const { data: smsConfig } = useQuery({
    queryKey: ["admin", "sms-config"],
    queryFn: () => cfgFn(),
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "sms-employees", { q, statusFilter, page, pageSize }],
    queryFn: () => listFn({ data: { q, statusFilter, page, pageSize } }),
    placeholderData: (prev) => prev,
  });

  const rows: SmsEmployeeRow[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const grandTotal = data?.grandTotal ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Bulk send logic
  const [bulkProgress, setBulkProgress] = useState<{ total: number; current: number } | null>(null);

  async function handleBulkSend() {
    const targetRows = rows.filter((r) => selectedIds.has(r.id));
    if (targetRows.length === 0) return;

    if (!confirm(`Are you sure you want to send Welcome SMS to ${targetRows.length} employee(s)?`)) {
      return;
    }

    setBulkProgress({ total: targetRows.length, current: 0 });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetRows.length; i++) {
      const emp = targetRows[i];
      setBulkProgress({ total: targetRows.length, current: i + 1 });
      try {
        const res = await sendFn({
          data: {
            mobile: emp.phone,
            email: emp.email,
            password: "",
            loginUrl: typeof window !== "undefined" ? window.location.origin : "",
          },
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setBulkProgress(null);
    setSelectedIds(new Set());
    toast.info(`Bulk SMS finish: ${successCount} sent, ${failCount} failed.`);
    qc.invalidateQueries({ queryKey: ["admin", "sms-employees"] });
  }

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground md:text-xl">
            SMS Broadcast
          </h2>
          <p className="text-xs text-muted-foreground">
            Send welcome credentials and track login SMS status for all employees ({grandTotal} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold shadow-xs hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* SMS Configuration Alert if disabled */}
      {smsConfig && !smsConfig.enabled && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold">SMS Service Disabled</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              SMS provider is currently disabled or unconfigured. Please configure ePush credentials under <strong>Settings → SMS</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, phone..."
            className="w-full rounded-full border border-input bg-card py-2 ps-9 pe-4 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setPage(1);
          }}
          className="rounded-full border border-input bg-card px-4 py-2 text-sm"
        >
          <option value="">All SMS Statuses</option>
          <option value="sent">Sent</option>
          <option value="not_sent">Not Sent</option>
          <option value="failed">Failed / Error</option>
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-brand">
            {selectedIds.size} employee(s) selected
          </span>
          <button
            onClick={handleBulkSend}
            disabled={!!bulkProgress}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {bulkProgress ? `Sending (${bulkProgress.current}/${bulkProgress.total})...` : "Send Selected Welcome SMS"}
          </button>
        </div>
      )}

      {/* Employees SMS Table */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-input"
                />
              </th>
              <th className="px-4 py-3 text-start font-medium">Employee</th>
              <th className="px-4 py-3 text-start font-medium">Phone</th>
              <th className="px-4 py-3 text-start font-medium">SMS Status</th>
              <th className="px-4 py-3 text-start font-medium">Last Sent Date</th>
              <th className="px-4 py-3 text-end font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((emp) => (
              <tr key={emp.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(emp.id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(emp.id);
                      else next.delete(emp.id);
                      setSelectedIds(next);
                    }}
                    className="rounded border-input"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar id={emp.id} name={emp.full_name} url={emp.avatar_url} className="h-9 w-9" />
                    <div>
                      <p className="font-semibold text-foreground">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {emp.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {emp.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" /> {emp.phone}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">No phone number</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {emp.smsStatus === "sent" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                    </span>
                  )}
                  {emp.smsStatus === "failed" && (
                    <span
                      title={emp.lastError || "Send error"}
                      className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive cursor-help"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Failed
                    </span>
                  )}
                  {emp.smsStatus === "not_sent" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Not Sent
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {emp.lastSentAt ? new Date(emp.lastSentAt).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-end">
                  <button
                    onClick={() => setModalEmployee(emp)}
                    disabled={!emp.phone}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-xs hover:bg-muted disabled:opacity-40"
                  >
                    <Send className="h-3 w-3 text-brand" />
                    {emp.smsStatus === "sent" ? "Resend" : "Send SMS"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  {isLoading ? "Loading employee list..." : "No employees found matching filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-input bg-card px-2 py-1"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {isFetching && <span className="text-muted-foreground/70">Loading…</span>}
          </div>
          <div className="flex items-center gap-2">
            <span>
              Page {page} of {totalPages} · {total} total
            </span>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-md border border-border bg-card px-2.5 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-border bg-card px-2.5 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Individual Send Modal */}
      {modalEmployee && (
        <SendSmsModal
          employee={modalEmployee}
          onClose={() => setModalEmployee(null)}
          onSuccess={() => {
            setModalEmployee(null);
            qc.invalidateQueries({ queryKey: ["admin", "sms-employees"] });
          }}
        />
      )}
    </div>
  );
}

function SendSmsModal({
  employee,
  onClose,
  onSuccess,
}: {
  employee: SmsEmployeeRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const sendFn = useServerFn(sendEmployeeWelcomeSms);
  const [customMsg, setCustomMsg] = useState("");
  const [isSending, setIsSending] = useState(false);

  const defaultMsg = `welcome to Integrated technics your user name is ${employee.email} and ${typeof window !== "undefined" ? window.location.origin : ""} , thanks\nHR department`;

  const activeMessage = customMsg.trim() || defaultMsg;

  async function handleSend() {
    setIsSending(true);
    try {
      const res = await sendFn({
        data: {
          mobile: employee.phone,
          email: employee.email,
          loginUrl: typeof window !== "undefined" ? window.location.origin : "",
          customMessage: activeMessage,
        },
      });

      if (res.ok) {
        toast.success(`Welcome SMS sent to ${employee.full_name}`);
        onSuccess();
      } else {
        toast.error(res.error || "Failed to send SMS");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error sending SMS");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Send Welcome SMS</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground">
            ✕
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
          <EmployeeAvatar id={employee.id} name={employee.full_name} url={employee.avatar_url} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{employee.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{employee.email} · {employee.phone}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Message Preview
            </label>
            <textarea
              rows={4}
              value={activeMessage}
              onChange={(e) => setCustomMsg(e.target.value)}
              className="w-full rounded-xl border border-input bg-card p-3 text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-xs font-semibold text-brand-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? "Sending..." : "Send SMS Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
