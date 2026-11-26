import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Building2,
  HardHat,
  WifiOff,
  AlertTriangle,
  Battery,
  Navigation,
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  History,
  Search,
  CheckCircle2,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { getLiveTrackingData, type TrackedEmployee } from "@/backend/functions/live-tracking.functions";
import { TrackingLeafletMap } from "./TrackingLeafletMap";

type Props = {
  onOpenRoutePlayback: (employeeId: string) => void;
  onOpenSecurity: () => void;
};

type StatusFilter = "all" | "in_office" | "field_staff" | "offline";

export function LiveTrackingTab({ onOpenRoutePlayback, onOpenSecurity }: Props) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data } = useQuery({
    queryKey: ["live-tracking-dashboard"],
    queryFn: () => getLiveTrackingData(),
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const employees = data?.employees ?? [];
  const geofences = data?.geofences ?? [];
  const recentEvents = data?.recentEvents ?? [];
  const stats = data?.stats ?? { activeNow: 0, inOffice: 0, fieldStaff: 0, offline: 0, alerts: 0 };

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (filter === "in_office" && e.status !== "in_office") return false;
      if (filter === "field_staff" && e.status !== "on_site" && e.status !== "in_transit") return false;
      if (filter === "offline" && e.status !== "offline") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q) ||
          e.assignedSiteName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, filter, search]);

  const filteredEvents = useMemo(() => {
    return recentEvents.filter((ev) => {
      if (eventFilter !== "all" && ev.eventType !== eventFilter) return false;
      if (siteFilter !== "all" && ev.siteName !== siteFilter) return false;
      return true;
    });
  }, [recentEvents, eventFilter, siteFilter]);

  const selectedEmployee: TrackedEmployee | null = useMemo(() => {
    if (!employees.length) return null;
    return employees.find((e) => e.id === selectedEmpId) ?? filteredEmployees[0] ?? employees[0];
  }, [employees, filteredEmployees, selectedEmpId]);

  const uniqueSites = useMemo(() => Array.from(new Set(recentEvents.map((e) => e.siteName).filter(Boolean))), [recentEvents]);

  return (
    <div className="space-y-4">
      {/* Top 5 KPI Cards (matching Mockup 1) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          title="Active Now"
          value={stats.activeNow}
          sub="Currently tracked"
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          icon={<Users className="w-5 h-5 text-emerald-600" />}
        />
        <KpiCard
          title="In Office"
          value={stats.inOffice}
          sub="At HQ / office"
          iconBg="bg-slate-100 dark:bg-slate-800"
          icon={<Building2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
        />
        <KpiCard
          title="Field Staff"
          value={stats.fieldStaff}
          sub="On-site & transit"
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          icon={<HardHat className="w-5 h-5 text-orange-600" />}
        />
        <KpiCard
          title="Offline"
          value={stats.offline}
          sub="No recent ping"
          iconBg="bg-slate-100 dark:bg-slate-800"
          icon={<WifiOff className="w-5 h-5 text-slate-500" />}
        />
        <KpiCard
          title="Alerts"
          value={stats.alerts}
          sub="Needs review"
          iconBg="bg-rose-50 dark:bg-rose-950/50"
          icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
          highlightBorder={stats.alerts > 0}
          onClick={onOpenSecurity}
        />
      </div>

      {/* Main Split: Interactive Map with Floating Filters + Right Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Container */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm relative">
          {/* Floating Filter Pills + Search Employee Top Bar */}
          <div className="absolute top-5 left-5 right-14 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
              {(
                [
                  { id: "all", label: `All Employees (${employees.length})` },
                  { id: "in_office", label: `In Office (${stats.inOffice})` },
                  { id: "field_staff", label: `Field Staff (${stats.fieldStaff})` },
                  { id: "offline", label: `Offline (${stats.offline})` },
                ] as { id: StatusFilter; label: string }[]
              ).map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm border transition-all ${
                    filter === pill.id
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative pointer-events-auto w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee name or code..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>

          <TrackingLeafletMap
            height={470}
            geofences={geofences.map((g) => ({
              id: g.id,
              name: g.name,
              lat: g.lat,
              lng: g.lng,
              radius: g.radius,
              count: g.count,
            }))}
            employees={filteredEmployees
              .filter((e) => e.latitude !== 0 || e.longitude !== 0)
              .map((e) => ({
                id: e.id,
                name: e.name,
                code: e.code,
                lat: e.latitude,
                lng: e.longitude,
                status: e.status,
                label: e.statusText,
              }))}
            route={
              selectedEmployee?.activeRoutePolyline
                ? {
                    coords: selectedEmployee.activeRoutePolyline,
                    color: "#2563eb",
                    startLabel: "Origin",
                    endLabel: selectedEmployee.name,
                  }
                : undefined
            }
            selectedId={
              selectedEmployee && (selectedEmployee.latitude !== 0 || selectedEmployee.longitude !== 0)
                ? selectedEmployee.id
                : null
            }
            onSelectEmployee={(id) => setSelectedEmpId(id)}
          />

          {/* Floating Bottom-Center Legend */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 text-[11px] font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Employee ({filteredEmployees.length})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-dashed border-orange-500 bg-orange-500/20" /> Geofence / Work Site ({geofences.length})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-blue-600 rounded" /> Route (Live)
            </span>
          </div>
        </div>

        {/* Right Inspector Card (matching Mockup 1) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between gap-3">
          {/* Search Employee Selector */}
          <div className="space-y-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee by name, code, site..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            {filteredEmployees.length > 0 && (
              <select
                value={selectedEmployee?.id ?? ""}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200"
              >
                {filteredEmployees.slice(0, 100).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.code}) — {emp.statusText}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedEmployee ? (
            <>
              <div className="space-y-3.5">
                {/* Profile Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {selectedEmployee.avatarUrl ? (
                      <img
                        src={selectedEmployee.avatarUrl}
                        alt={selectedEmployee.name}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-base">
                        {selectedEmployee.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{selectedEmployee.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{selectedEmployee.code}</p>
                      <p className="text-xs text-slate-500">{selectedEmployee.department}</p>
                    </div>
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-slate-400" />
                </div>

                {/* Full-width Status Pill Bar */}
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold ${
                    selectedEmployee.status === "offline"
                      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedEmployee.statusText}
                  </span>
                  <span className="text-[11px] font-medium opacity-80">Since {selectedEmployee.sinceTime}</span>
                </div>

                {/* Telemetry Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Battery className="w-4 h-4 text-slate-400" /> Battery
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedEmployee.battery != null ? `${selectedEmployee.battery}%` : "Not reported"}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-slate-400" /> GPS Accuracy
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedEmployee.gpsAccuracyMeters != null ? `±${selectedEmployee.gpsAccuracyMeters} m` : "—"}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" /> Last Update
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedEmployee.lastUpdateAgo}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" /> Assigned Site
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white text-right">{selectedEmployee.assignedSiteName}</span>
                  </div>
                  <div className="py-2.5 flex items-start justify-between gap-2">
                    <span className="text-slate-500 flex items-center gap-2 shrink-0">
                      <MapPin className="w-4 h-4 text-slate-400" /> Coordinates
                    </span>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${selectedEmployee.latitude}&mlon=${selectedEmployee.longitude}#map=16/${selectedEmployee.latitude}/${selectedEmployee.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-slate-700 dark:text-slate-300 hover:text-orange-600 inline-flex items-center gap-1"
                    >
                      {selectedEmployee.currentAddress} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Quick Actions (4 icon cards matching mockup) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Quick Actions</div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => onOpenRoutePlayback(selectedEmployee.id)}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 text-[11px] font-semibold transition-colors"
                  >
                    <History className="w-4 h-4" />
                    <span>History</span>
                  </button>
                  <a
                    href={selectedEmployee.phone ? `tel:${selectedEmployee.phone}` : undefined}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call</span>
                  </a>
                  <a
                    href="/admin/chat"
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Message</span>
                  </a>
                  <button
                    onClick={onOpenSecurity}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    <span>Investigate</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-xs text-slate-400">
              No active employees with GPS coordinates or geofence assignments yet.
            </div>
          )}
        </div>
      </div>

      {/* Recent Events (Live Activity) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Events <span className="font-normal text-slate-500">(Live Activity)</span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
            >
              <option value="all">All Events</option>
              <option value="checkin">Check-In</option>
              <option value="checkout">Check-Out</option>
              <option value="alert">Alerts</option>
            </select>

            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
            >
              <option value="all">All Sites</option>
              {uniqueSites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              <span>Auto-refresh (10s)</span>
              <span
                className={`w-8 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                  autoRefresh ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-white shadow" />
              </span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2.5 px-4 font-semibold">Time</th>
                <th className="py-2.5 px-4 font-semibold">Employee</th>
                <th className="py-2.5 px-4 font-semibold">Event</th>
                <th className="py-2.5 px-4 font-semibold">Details</th>
                <th className="py-2.5 px-4 font-semibold">Location / Site</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No live attendance or tracking events recorded today yet.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => setSelectedEmpId(ev.employeeId)}
                    className={`cursor-pointer transition-colors ${
                      ev.severity === "danger"
                        ? "bg-orange-50/70 hover:bg-orange-100/60 dark:bg-rose-950/20"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">{ev.time}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {ev.employeeName} <span className="text-slate-400 font-normal">({ev.employeeCode})</span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-semibold">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          ev.severity === "danger"
                            ? "text-orange-600"
                            : ev.severity === "success"
                              ? "text-emerald-600"
                              : "text-blue-600"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            ev.severity === "danger" ? "bg-orange-600" : ev.severity === "success" ? "bg-emerald-600" : "bg-blue-600"
                          }`}
                        />
                        {ev.event}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{ev.details}</td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{ev.siteName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon,
  iconBg,
  highlightBorder,
  onClick,
}: {
  title: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  highlightBorder?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border p-3.5 shadow-sm flex items-center gap-3 ${
        highlightBorder
          ? "border-rose-200 bg-rose-50/30 dark:border-rose-800"
          : "border-slate-200/80 dark:border-slate-800"
      } ${onClick ? "cursor-pointer hover:border-orange-300 transition-colors" : ""}`}
    >
      <div className={`w-11 h-11 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</div>
        <div className="text-[11px] text-slate-400">{sub}</div>
      </div>
    </div>
  );
}
