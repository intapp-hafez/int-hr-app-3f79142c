import { createFileRoute } from "@tanstack/react-router";
import { AttendancePage } from "@/components/employee/AttendancePage";

export const Route = createFileRoute("/employee/attendance")({
  head: () => ({ meta: [
    { title: "My Attendance | INT-HR" },
    { name: "description", content: "Review your attendance records, work hours, and check-in validation history in INT-HR." },
    { property: "og:title", content: "My Attendance | INT-HR" },
    { property: "og:description", content: "Review your attendance records, work hours, and check-in validation history in INT-HR." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AttendancePage,
});