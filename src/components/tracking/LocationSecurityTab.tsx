import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Radio,
  Smartphone,
  FileSearch,
  CheckCircle2,
  PauseCircle,
  Mail,
  FolderOpen,
  Send,
  Battery,
  Navigation,
  Wifi,
  AlertTriangle,
} from "lucide-react";
import {
  getLocationSecurityData,
  updateSecurityAlertAction,
  type LocationSecurityAlertItem,
} from "@/backend/functions/live-tracking.functions";
import { TrackingLeafletMap } from "./TrackingLeafletMap";

type SeverityFilter = "all" | "high" | "medium" | "low";

export function LocationSecurityTab() {
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedAlertId, setSelectedAlertId] = useState<string>("");
  const [noteInput, setNoteInput] = useState("");
  const [actionToast, setActionToast] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["location-security-data", selectedAlertId],
    queryFn: () => getLocationSecurityData({ data: { alertId: selectedAlertId || undefined } }),
  });

  const actionMutation = useMutation({
    mutationFn: (payload: {
      alertId: string;
      action: "mark_reviewed" | "suspend_tracking" | "notify_manager" | "open_case" | "add_note";
      noteText?: string;
    }) => updateSecurityAlertAction({ data: payload }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["location-security-data"] });
      const labels: Record<string, string> = {
        mark_reviewed: "Alert marked as reviewed",
        suspend_tracking: "Employee tracking suspended",
        notify_manager: "Line manager notified",
        open_case: "Formal investigation case opened",
        add_note: "Investigation note added",
      };
      setActionToast(labels[vars.action] ?? "Action completed");
      if (vars.action === "add_note") setNoteInput("");
      setTimeout(() => setActionToast(null), 3000);
    },
  });

  const alerts = data?.alerts ?? [];
  const filteredAlerts = useMemo(() => {
    if (severityFilter === "all") return alerts;
    return alerts.filter((a) => a.severity === severityFilter);
  }, [alerts, severityFilter]);

  const activeAlert: LocationSecurityAlertItem | null =
    filteredAlerts.find((a) => a.id === selectedAlertId) ?? data?.selectedAlert ?? filteredAlerts[0] ?? null;

  const stats = data?.stats ?? { alerts: 0, spoofingRisk: 0, staleDevices: 0, openInvestigations: 0 };

  if (isLoading && !activeAlert && alerts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500">
        Loading anti-spoofing & security alerts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 4 Security KPIs (matching Mockup 4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SecKpi title="Alerts" value={stats.alerts} icon={<AlertTriangle className="w-5 h-5 text-orange-600" />} bg="bg-orange-50 dark:bg-orange-950/50" />
        <SecKpi title="Spoofing Risk" value={stats.spoofingRisk} icon={<Radio className="w-5 h-5 text-orange-600" />} bg="bg-orange-50 dark:bg-orange-950/50" />
        <SecKpi title="Stale Devices" value={stats.staleDevices} icon={<Smartphone className="w-5 h-5 text-slate-600 dark:text-slate-300" />} bg="bg-slate-100 dark:bg-slate-800" />
        <SecKpi title="Open Investigations" value={stats.openInvestigations} icon={<FileSearch className="w-5 h-5 text-slate-600 dark:text-slate-300" />} bg="bg-slate-100 dark:bg-slate-800" />
      </div>

      {actionToast && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {actionToast}
        </div>
      )}

      {/* Main Split: Alert Queue (left) + Investigation Panel (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Alert Queue */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-orange-600" /> Alert Queue
            </h3>
            <span className="text-[11px] text-slate-400">Live Alerts</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: `All (${alerts.length})` },
                { id: "high", label: `High (${alerts.filter((a) => a.severity === "high").length})` },
                { id: "medium", label: `Medium (${alerts.filter((a) => a.severity === "medium").length})` },
                { id: "low", label: `Low (${alerts.filter((a) => a.severity === "low").length})` },
              ] as { id: SeverityFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setSeverityFilter(f.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-colors ${
                  severityFilter === f.id
                    ? "bg-orange-600 text-white border-orange-600"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No security alerts or blocked attendance attempts found. Everything looks clean!
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2 pr-2">Time</th>
                    <th className="py-2 pr-2">Employee</th>
                    <th className="py-2 pr-2">Issue Type</th>
                    <th className="py-2">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAlerts.map((alert) => {
                    const isSel = alert.id === activeAlert?.id;
                    return (
                      <tr
                        key={alert.id}
                        onClick={() => setSelectedAlertId(alert.id)}
                        className={`cursor-pointer transition-colors ${
                          isSel ? "bg-orange-50/90 dark:bg-orange-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="py-2.5 pr-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">{alert.time}</td>
                        <td className="py-2.5 pr-2">
                          <div className="font-semibold text-slate-900 dark:text-white">{alert.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{alert.employeeCode}</div>
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{alert.issueTypeLabel}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{alert.locationDetails}</div>
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                              alert.severity === "high"
                                ? "bg-rose-600 text-white"
                                : alert.severity === "medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Case Details & Evidence */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between gap-4">
          {activeAlert ? (
            <>
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeAlert.employeeName} <span className="font-normal text-slate-500">({activeAlert.employeeCode})</span>
                    </h3>
                    <p className="text-xs text-slate-500">{activeAlert.department}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    ▲ {activeAlert.severity === "high" ? "High Risk" : "Medium Risk"}
                  </span>
                </div>

                {/* Row 1: Case Details + Map Snapshot */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-xs">
                    <h4 className="font-bold text-slate-800 dark:text-white">Case Details</h4>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Alert ID</span>
                      <span className="font-mono font-semibold">{activeAlert.alertId}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Issue Type</span>
                      <span className="font-semibold">{activeAlert.issueTypeLabel}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Detected</span>
                      <span className="font-medium">{activeAlert.detectedAt}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Location</span>
                      <span className="font-medium">{activeAlert.siteName}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Status</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                        {activeAlert.caseStatus}
                      </span>
                    </div>
                  </div>

                  <TrackingLeafletMap
                    height={190}
                    center={[activeAlert.mapSnapshot.breachLat, activeAlert.mapSnapshot.breachLng]}
                    zoom={14}
                    geofences={[
                      {
                        id: "snap-site",
                        name: activeAlert.mapSnapshot.siteName,
                        lat: activeAlert.mapSnapshot.centerLat,
                        lng: activeAlert.mapSnapshot.centerLng,
                        radius: activeAlert.mapSnapshot.siteRadiusMeters,
                        color: "#ea580c",
                      },
                    ]}
                    employees={[
                      {
                        id: activeAlert.employeeId,
                        name: activeAlert.employeeName,
                        code: activeAlert.employeeCode,
                        lat: activeAlert.mapSnapshot.breachLat,
                        lng: activeAlert.mapSnapshot.breachLng,
                        status: "breach",
                        label: activeAlert.issueTypeLabel,
                      },
                    ]}
                  />
                </div>

                {/* Row 2: Evidence Timeline + Device Signals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Evidence Timeline</h4>
                    <div className="space-y-2.5">
                      {activeAlert.evidenceTimeline.map((ev, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start text-xs">
                          <span className="font-mono text-[11px] text-slate-400 w-14 shrink-0">{ev.time}</span>
                          <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-700 relative">
                            <span
                              className={`w-2 h-2 rounded-full absolute -left-[5px] top-1 ${
                                ev.isAnomaly ? "bg-rose-600" : "bg-emerald-600"
                              }`}
                            />
                            <div className={`font-semibold ${ev.isAnomaly ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>
                              {ev.title}
                            </div>
                            <div className="text-[11px] text-slate-500">{ev.subtitle}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <h4 className="font-bold text-slate-800 dark:text-white">Device Signals</h4>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Device</span>
                      <span className="font-semibold">{activeAlert.deviceSignals.deviceModel}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Battery className="w-3 h-3" /> Battery
                      </span>
                      <span className="font-semibold">
                        {activeAlert.deviceSignals.battery != null ? `${activeAlert.deviceSignals.battery}%` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> GPS Accuracy
                      </span>
                      <span className="font-semibold">{activeAlert.deviceSignals.gpsAccuracy}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> Network
                      </span>
                      <span className="font-semibold">{activeAlert.deviceSignals.network}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Mock Location</span>
                      <span className={`font-bold ${activeAlert.deviceSignals.mockLocationDetected ? "text-rose-600" : "text-emerald-600"}`}>
                        {activeAlert.deviceSignals.mockLocationDetected ? "Detected" : "Not Detected ✓"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Recommended Actions + Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Recommended Actions</h4>
                    <div className="space-y-1.5">
                      {activeAlert.recommendedActions.map((act) => (
                        <label key={act.id} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <input type="checkbox" defaultChecked={act.checked} className="mt-0.5 accent-orange-600 rounded" />
                          <span>{act.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Notes</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add a note..."
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                      />
                      <button
                        onClick={() => {
                          if (!noteInput.trim()) return;
                          actionMutation.mutate({ alertId: activeAlert.id, action: "add_note", noteText: noteInput.trim() });
                        }}
                        className="p-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar (matching Mockup 4) */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => actionMutation.mutate({ alertId: activeAlert.id, action: "mark_reviewed" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Reviewed
                </button>
                <button
                  onClick={() => actionMutation.mutate({ alertId: activeAlert.id, action: "suspend_tracking" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold"
                >
                  <PauseCircle className="w-3.5 h-3.5" /> Suspend Tracking
                </button>
                <button
                  onClick={() => actionMutation.mutate({ alertId: activeAlert.id, action: "notify_manager" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                >
                  <Mail className="w-3.5 h-3.5" /> Notify Manager
                </button>
                <button
                  onClick={() => actionMutation.mutate({ alertId: activeAlert.id, action: "open_case" })}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Open Case
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-xs text-slate-400">Select an alert from the queue to inspect evidence</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SecKpi({ title, value, icon, bg }: { title: string; value: number; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{title}</div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      </div>
    </div>
  );
}
