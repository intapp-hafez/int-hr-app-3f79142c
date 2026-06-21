import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/employee/SettingsPage";

export const Route = createFileRoute("/employee/settings")({
  component: SettingsPage,
});