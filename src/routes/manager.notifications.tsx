import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/routes/employee.notifications";

export const Route = createFileRoute("/manager/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Manager · INT HR" },
      { name: "description", content: "Leave, advance and task alerts for managers." },
      { property: "og:title", content: "Notifications — Manager · INT HR" },
      { property: "og:description", content: "Leave, advance and task alerts for managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <NotificationsPage />,
});
