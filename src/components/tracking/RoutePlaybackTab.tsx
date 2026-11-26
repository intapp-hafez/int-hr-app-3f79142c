import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Smartphone,
  Battery,
  Wifi,
  Navigation,
  MapPin,
  Clock,
  Route as RouteIcon,
  Gauge,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { getEmployeeRoutePlayback, getLiveTrackingData } from "@/backend/functions/live-tracking.functions";
import { TrackingLeafletMap } from "./TrackingLeafletMap";

type Props = {
  initialEmployeeId?: string | null;
  onBack?: () => void;
};

export function RoutePlaybackTab({ initialEmployeeId, onBack }: Props) {
  const [employeeId, setEmployeeId] = useState<string>(initialEmployeeId ?? "");
  const [empSearch, setEmpSearch] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2 | 4>(1);

  useEffect(() => {
    if (initialEmployeeId) setEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

  const { data: empListData } = useQuery({
    queryKey: ["live-tracking-employees-selector"],
    queryFn: () => getLiveTrackingData(),
  });

  const employees = empListData?.employees ?? [];
  const filteredEmps = useMemo(() => {
    if (!empSearch.trim()) return employees;
    const q = empSearch.toLowerCase();
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
  }, [employees, empSearch]);
  const activeEmpId = employeeId || filteredEmps[0]?.id || employees[0]?.id || "";

  const { data, isLoading } = useQuery({
    queryKey: ["route-playback", activeEmpId, date],
    queryFn: () => getEmployeeRoutePlayback({ data: { employeeId: activeEmpId || undefined, date } }),
  });

  const waypoints = data?.waypoints ?? [];
  const maxIdx = Math.max(0, waypoints.length - 1);

  useEffect(() => {
    setProgressIdx(0);
    setIsPlaying(false);
  }, [activeEmpId, date]);

  useEffect(() => {
    if (!isPlaying || maxIdx === 0) return;
    const intervalMs = Math.round(1200 / speedMultiplier);
    const timer = setInterval(() => {
      setProgressIdx((prev) => {
        if (prev >= maxIdx) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, speedMultiplier, maxIdx]);

  const currentWaypoint = waypoints[progressIdx] ?? waypoints[0];
  const coords = useMemo<[number, number][]>(() => waypoints.map((w) => [w.lat, w.lng]), [waypoints]);

  if (isLoading || !data) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500">
        Loading employee tracking details...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Employee Header Bar (matching Mockup 2) */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title="Back to Live Tracking"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-sm">
            {data.employee.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search employee..."
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs w-40 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <select
                value={activeEmpId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="font-bold text-sm text-slate-900 dark:text-white bg-transparent focus:outline-none cursor-pointer"
              >
                {filteredEmps.length === 0 ? (
                  <option value="">{data.employee.name}</option>
                ) : (
                  filteredEmps.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.code})
                    </option>
                  ))
                )}
              </select>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {data.employee.status}
              </span>
            </div>
            <div className="text-xs text-slate-500">{data.employee.department} · {data.employee.workLocation}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
            />
          </div>
          <span className="text-xs font-medium text-slate-500 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            Site: {data.employee.workLocation}
          </span>
        </div>
      </div>

      {/* Main Split: Left Profile + Device, Right Map + Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Profile</h4>
            <div className="space-y-2 text-xs">
              <ProfileRow label="Code" value={data.employee.code} />
              <ProfileRow label="Department" value={data.employee.department} />
              <ProfileRow label="Role" value={data.employee.role} />
              <ProfileRow label="Phone" value={data.employee.phone} />
              <ProfileRow label="Email" value={data.employee.email} />
              <ProfileRow label="Reporting To" value={data.employee.reportingTo} />
              <ProfileRow label="Work Location" value={data.employee.workLocation} />
              <ProfileRow label="Shift" value={data.employee.shift} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-orange-600" /> Device & Connectivity
            </h4>
            <div className="space-y-2 text-xs">
              <ProfileRow label="Device" value={data.device.model} />
              <ProfileRow label="OS Version" value={data.device.osVersion} />
              <ProfileRow label="App Version" value={data.device.appVersion} />
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> GPS Accuracy
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">{data.device.gpsAccuracy}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 flex items-center gap-1">
                  <Battery className="w-3 h-3" /> Battery
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {data.device.battery != null ? `${data.device.battery}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Network
                </span>
                <span className="font-semibold text-emerald-600">{data.device.network}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 space-y-4">
          {/* Map + Orange Playback Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-sm space-y-3 relative">
            <div className="absolute top-5 left-5 z-[400] flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-600 text-white text-xs font-bold shadow-sm">
                <Play className="w-3 h-3" /> Route Playback
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-sm">
                {date}
              </span>
              <select
                value={speedMultiplier}
                onChange={(e) => setSpeedMultiplier(Number(e.target.value) as 1 | 2 | 4)}
                className="px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-sm"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>

            <TrackingLeafletMap
              height={320}
              route={{
                coords,
                color: "#2563eb",
                startLabel: waypoints[0]?.label ?? "Start",
                endLabel: waypoints[maxIdx]?.label ?? "End",
                animatedPosition: currentWaypoint ? [currentWaypoint.lat, currentWaypoint.lng] : null,
              }}
            />

            {/* Orange Playback Scrubber */}
            <div className="flex items-center gap-2.5 px-2 py-1">
              <button
                disabled={waypoints.length === 0}
                onClick={() => {
                  if (progressIdx >= maxIdx) setProgressIdx(0);
                  setIsPlaying((v) => !v);
                }}
                className="w-8 h-8 rounded-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white flex items-center justify-center shadow-sm"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              <button
                disabled={waypoints.length === 0}
                onClick={() => setProgressIdx((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={waypoints.length === 0}
                onClick={() => setProgressIdx((p) => Math.min(maxIdx, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs font-semibold">
                {currentWaypoint?.time ?? "—"}
              </span>
              <input
                type="range"
                min={0}
                max={maxIdx}
                value={progressIdx}
                disabled={waypoints.length === 0}
                onChange={(e) => {
                  setIsPlaying(false);
                  setProgressIdx(Number(e.target.value));
                }}
                className="flex-1 accent-orange-600 cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-500">{waypoints[maxIdx]?.time ?? "—"}</span>
            </div>
          </div>

          {/* 3-Column Grid: Movement Timeline | Route Summary | Location Stamps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Movement Timeline</h4>
              {data.timeline.length === 0 ? (
                <p className="text-xs text-slate-400">No movement recorded on {date}.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.timeline.map((item, idx) => (
                    <div key={idx} className="flex gap-2.5 items-start text-xs">
                      <span className="font-mono text-[11px] text-slate-400 w-14 shrink-0">{item.time}</span>
                      <div className="pl-3 border-l-2 border-orange-200 dark:border-orange-900 relative">
                        <span className="w-2 h-2 rounded-full bg-orange-600 absolute -left-[5px] top-1" />
                        <div className="font-semibold text-slate-900 dark:text-white">{item.title}</div>
                        <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Route Summary</h4>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <RouteIcon className="w-3 h-3" /> Distance
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{data.summary.distanceKm} km</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Travel Time
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{data.summary.travelTimeMinutes} min</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Avg Speed
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{data.summary.avgSpeedKmh} km/h</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Max Speed
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{data.summary.maxSpeedKmh} km/h</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Site</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{data.summary.routeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="font-semibold text-emerald-600">{data.summary.status}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-orange-600" /> Location Stamps
              </h4>
              {data.locationStamps.length === 0 ? (
                <p className="text-xs text-slate-400">No GPS stamps recorded.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {data.locationStamps.map((st, idx) => (
                    <div key={idx} className="pb-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">{st.name}</span>
                        <span className="font-mono text-[11px] text-slate-400">{st.time}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">{st.coords}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom 2-Column Grid: Check-In / Check-Out Activity | Day Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Check-In / Check-Out Activity</h4>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-1.5">Type</th>
                    <th className="py-1.5">Time</th>
                    <th className="py-1.5">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.checkInOutActivity.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">
                        No check-ins on {date}
                      </td>
                    </tr>
                  ) : (
                    data.checkInOutActivity.map((act, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-semibold text-slate-900 dark:text-white">{act.type}</td>
                        <td className="py-2 font-mono text-slate-500">{act.time}</td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">{act.location}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Day Summary ({date})</h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <ProfileRow label="Attendance Sessions" value={data.daySummary.totalOnSiteTime} />
                <ProfileRow label="GPS Pings Recorded" value={data.daySummary.totalTravelTime} />
                <ProfileRow label="Total Distance" value={`${data.daySummary.totalDistanceKm} km`} />
                <ProfileRow label="Sites Visited" value={String(data.daySummary.sitesVisitedCount)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-white text-right">{value}</span>
    </div>
  );
}
