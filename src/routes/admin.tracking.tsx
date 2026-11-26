import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, PlayCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { LiveTrackingTab } from "@/components/tracking/LiveTrackingTab";
import { RoutePlaybackTab } from "@/components/tracking/RoutePlaybackTab";
import { GeofenceManagementTab } from "@/components/tracking/GeofenceManagementTab";
import { LocationSecurityTab } from "@/components/tracking/LocationSecurityTab";

export const Route = createFileRoute("/admin/tracking")({
  component: AdminTrackingPage,
});

type TrackingTabId = "live" | "playback" | "geofences" | "security";

function AdminTrackingPage() {
  const [activeTab, setActiveTab] = useState<TrackingTabId>("live");
  const [playbackEmployeeId, setPlaybackEmployeeId] = useState<string | null>(null);

  const tabs: { id: TrackingTabId; label: string; icon: React.ReactNode }[] = [
    { id: "live", label: "Live Tracking", icon: <Radio className="w-4 h-4" /> },
    { id: "playback", label: "Route Playback", icon: <PlayCircle className="w-4 h-4" /> },
    { id: "geofences", label: "Geofences & Rules", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "security", label: "Security & Investigation", icon: <ShieldAlert className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {activeTab === "live"
              ? "Live Employee Tracking"
              : activeTab === "playback"
                ? "Employee Tracking Details"
                : activeTab === "geofences"
                  ? "Geofence Management"
                  : "Location Security & Investigation"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "live" && (
        <LiveTrackingTab
          onOpenRoutePlayback={(empId) => {
            setPlaybackEmployeeId(empId);
            setActiveTab("playback");
          }}
          onOpenSecurity={() => setActiveTab("security")}
        />
      )}
      {activeTab === "playback" && (
        <RoutePlaybackTab
          initialEmployeeId={playbackEmployeeId}
          onBack={() => setActiveTab("live")}
        />
      )}
      {activeTab === "geofences" && <GeofenceManagementTab />}
      {activeTab === "security" && <LocationSecurityTab />}
    </div>
  );
}
