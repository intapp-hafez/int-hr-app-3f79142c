import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/employee/SettingsPage";

export const Route = createFileRoute("/staff/profile")({
  component: StaffProfile,
});

function StaffProfile() {
  return (
    <div className="space-y-4">
      <SettingsPage />
    </div>
  );
}