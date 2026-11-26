import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Minus,
  Check,
  Clock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  getGeofenceManagementData,
  saveGeofenceSitePolicy,
  type GeofenceSiteWithPolicy,
} from "@/backend/functions/live-tracking.functions";
import { TrackingLeafletMap } from "./TrackingLeafletMap";

export function GeofenceManagementTab() {
  const queryClient = useQueryClient();
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [siteSearch, setSiteSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [editName, setEditName] = useState("");
  const [editRadius, setEditRadius] = useState(300);
  const [editSiteType, setEditSiteType] = useState("Main Office");
  const [rules, setRules] = useState({
    allowCheckinWithinGeofenceOnly: true,
    allowCheckoutWithinGeofenceOnly: true,
    blockCheckinOutsideSchedule: false,
    requireManagerApproval: false,
  });
  const [savedNotice, setSavedNotice] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["geofence-management", selectedSiteId],
    queryFn: () => getGeofenceManagementData({ data: { siteId: selectedSiteId || undefined } }),
  });

  const sites = data?.sites ?? [];
  const filteredSites = useMemo(() => {
    return sites.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (siteSearch.trim() && !s.name.toLowerCase().includes(siteSearch.toLowerCase())) return false;
      return true;
    });
  }, [sites, statusFilter, siteSearch]);

  const activeSite: GeofenceSiteWithPolicy | null = data?.selectedSite ?? filteredSites[0] ?? null;

  useEffect(() => {
    if (activeSite) {
      setEditName(activeSite.name);
      setEditRadius(activeSite.radiusMeters);
      setEditSiteType(activeSite.siteType);
      setRules(activeSite.rules);
    }
  }, [activeSite?.id]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveGeofenceSitePolicy({
        data: {
          siteId: activeSite!.id,
          name: editName,
          radiusMeters: editRadius,
          siteType: editSiteType,
          rules,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofence-management"] });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    },
  });

  const activeCount = sites.filter((s) => s.status === "Active").length;
  const totalAssigned = sites.reduce((acc, s) => acc + s.assignedCount, 0);
  const totalDepts = new Set(sites.flatMap((s) => s.departments)).size;

  if (isLoading && !activeSite) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500">
        Loading geofence sites and policies...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 5 KPI Cards (matching Mockup 3) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <GeoKpi title="Total Locations" value={sites.length} icon={<MapPin className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50 dark:bg-emerald-950/50" />
        <GeoKpi title="Active Geofences" value={activeCount} icon={<CheckCircle2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />} bg="bg-slate-100 dark:bg-slate-800" />
        <GeoKpi title="Assigned Employees" value={totalAssigned} icon={<Users className="w-5 h-5 text-orange-600" />} bg="bg-orange-50 dark:bg-orange-950/50" />
        <GeoKpi title="Departments" value={totalDepts} icon={<Building2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />} bg="bg-slate-100 dark:bg-slate-800" />
        <GeoKpi title="Strict Rules Active" value={sites.filter((s) => s.rules.allowCheckinWithinGeofenceOnly).length} icon={<AlertTriangle className="w-5 h-5 text-rose-600" />} bg="bg-rose-50 dark:bg-rose-950/50" />
      </div>

      {/* 3-Column Layout: Locations List | Map | Site Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Column 1: Work Locations & Geofences */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-sm flex flex-col justify-between gap-3">
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Work Locations & Geofences</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                placeholder="Search location..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {filteredSites.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center">No geofence locations found</div>
              ) : (
                filteredSites.map((site) => {
                  const isSel = site.id === activeSite?.id;
                  return (
                    <button
                      key={site.id}
                      onClick={() => setSelectedSiteId(site.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                        isSel
                          ? "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700"
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{site.name}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            site.status === "Active" ? "text-emerald-600" : "text-slate-400"
                          }`}
                        >
                          ● {site.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {site.radiusMeters} m · {site.assignedCount} assigned
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <Link
            to="/admin/geofencing"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Manage / Add Geofence
          </Link>
        </div>

        {/* Column 2: Interactive Zone Map */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm">
          {activeSite ? (
            <TrackingLeafletMap
              height={460}
              center={[activeSite.latitude, activeSite.longitude]}
              zoom={14}
              selectedId={activeSite.id}
              geofences={sites.map((s) => ({
                id: s.id,
                name: s.name,
                lat: s.latitude,
                lng: s.longitude,
                radius: s.id === activeSite.id ? editRadius : s.radiusMeters,
                color: "#ea580c",
              }))}
              onSelectGeofence={(id) => setSelectedSiteId(id)}
            />
          ) : (
            <div className="h-[460px] flex items-center justify-center text-xs text-slate-400">
              Add a geofence location in Geo-Fencing to visualize it here.
            </div>
          )}
        </div>

        {/* Column 3: Site Settings */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between gap-3">
          {activeSite ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Site Settings — {activeSite.name}</h3>
                    <span className="text-[11px] font-semibold text-emerald-600">● {activeSite.status}</span>
                  </div>
                  {savedNotice && <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Site Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Site Type</label>
                    <select
                      value={editSiteType}
                      onChange={(e) => setEditSiteType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                    >
                      <option value="Main Office">Main Office</option>
                      <option value="Project Site">Project Site</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Client Premise">Client Premise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Assigned Employees</label>
                    <div className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold">
                      {activeSite.assignedCount} employees
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Radius (Geofence) *</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditRadius((r) => Math.max(50, r - 50))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      value={editRadius}
                      onChange={(e) => setEditRadius(Math.max(20, Number(e.target.value) || 100))}
                      className="w-24 text-center px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                    />
                    <button
                      onClick={() => setEditRadius((r) => Math.min(5000, r + 50))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-slate-500">Meters</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-semibold text-slate-500">Allowed Check-In Rules *</label>
                  <OrangeCheck
                    label="Allow check-in within geofence only"
                    checked={rules.allowCheckinWithinGeofenceOnly}
                    onChange={(v) => setRules((r) => ({ ...r, allowCheckinWithinGeofenceOnly: v }))}
                  />
                  <OrangeCheck
                    label="Allow check-out within geofence only"
                    checked={rules.allowCheckoutWithinGeofenceOnly}
                    onChange={(v) => setRules((r) => ({ ...r, allowCheckoutWithinGeofenceOnly: v }))}
                  />
                  <OrangeCheck
                    label="Block check-in outside work schedule"
                    checked={rules.blockCheckinOutsideSchedule}
                    onChange={(v) => setRules((r) => ({ ...r, blockCheckinOutsideSchedule: v }))}
                  />
                  <OrangeCheck
                    label="Require manager approval for exceptions"
                    checked={rules.requireManagerApproval}
                    onChange={(v) => setRules((r) => ({ ...r, requireManagerApproval: v }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setEditName(activeSite.name);
                    setEditRadius(activeSite.radiusMeters);
                    setRules(activeSite.rules);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-xs text-slate-400">Select a geofence site</div>
          )}
        </div>
      </div>

      {/* Bottom 2-Column Tables: Assigned Employees | Recent Geofence Events */}
      {activeSite && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-orange-600" /> Assigned Employees ({activeSite.assignedEmployees.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2">Employee</th>
                    <th className="py-2">Department</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Assignment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeSite.assignedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No employees assigned to this site yet.
                      </td>
                    </tr>
                  ) : (
                    activeSite.assignedEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td className="py-2 font-semibold text-slate-900 dark:text-white">
                          {emp.name} <span className="text-slate-400 font-normal">({emp.code})</span>
                        </td>
                        <td className="py-2 text-slate-500">{emp.department}</td>
                        <td className="py-2 text-slate-500">{emp.role}</td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            {emp.assignment}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-600" /> Recent Geofence Events ({activeSite.name})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2">Time</th>
                    <th className="py-2">Employee</th>
                    <th className="py-2">Event</th>
                    <th className="py-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeSite.recentEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No recent check-ins recorded at this site.
                      </td>
                    </tr>
                  ) : (
                    activeSite.recentEvents.map((ev, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-mono text-slate-500">{ev.time}</td>
                        <td className="py-2 font-semibold text-slate-900 dark:text-white">{ev.employeeName}</td>
                        <td className="py-2 text-emerald-600 font-semibold">{ev.event}</td>
                        <td className="py-2 text-slate-500">{ev.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GeoKpi({ title, value, icon, bg }: { title: string; value: number; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{title}</div>
        <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

function OrangeCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-orange-600"
      />
      <span>{label}</span>
    </label>
  );
}
