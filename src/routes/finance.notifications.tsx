import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/routes/employee.notifications";

export const Route = createFileRoute("/finance/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Finance · INT HR" },
      { name: "description", content: "Advance approvals and payment alerts for the finance team." },
      { property: "og:title", content: "Notifications — Finance · INT HR" },
      { property: "og:description", content: "Advance approvals and payment alerts for the finance team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <NotificationsPage />,
});
