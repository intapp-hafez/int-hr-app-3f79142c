import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TripAllowancePayrollTab } from "@/components/payroll/TripAllowancePayrollTab";

export const Route = createFileRoute("/manager/trip-allowances")({
  head: () => ({
    meta: [
      { title: "Team trip allowances — Manager" },
      { name: "description", content: "Review and approve your team's monthly trip allowances." },
      { property: "og:title", content: "Team trip allowances — Manager" },
      { property: "og:description", content: "Review and approve your team's monthly trip allowances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagerTripAllowances,
});

function ManagerTripAllowances() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  return (
    <div className="space-y-3">
      <input type="month" value={`${year}-${String(month).padStart(2, "0")}`} onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); if (y && m) { setYear(y); setMonth(m); } }} className="h-9 rounded-xl border border-input bg-background px-3 text-sm" />
      <TripAllowancePayrollTab year={year} month={month} />
    </div>
  );
}
