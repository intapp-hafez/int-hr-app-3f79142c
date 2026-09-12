import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/routes/employee.notifications";

export const Route = createFileRoute("/staff/notifications")({
  component: StaffNotificationsPage,
});

function StaffNotificationsPage() {
  return <NotificationsPage />;
}
