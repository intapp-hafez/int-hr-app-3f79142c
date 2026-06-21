import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "./employee.settings";

export const Route = createFileRoute("/manager/profile")({
  component: ManagerProfile,
});

function ManagerProfile() {
  return <SettingsPage />;
}
