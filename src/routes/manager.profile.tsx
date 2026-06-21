import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/employee/SettingsPage";

export const Route = createFileRoute("/manager/profile")({
  component: ManagerProfile,
});

function ManagerProfile() {
  return <SettingsPage />;
}
