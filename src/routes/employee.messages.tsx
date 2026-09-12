import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/employee/messages")({
  component: RedirectToChat,
});

function RedirectToChat() {
  const session = useSession();
  const isStaff = session?.roles?.includes("staff") && !session?.roles?.some((r) => ["admin", "hr", "manager", "employee"].includes(r));
  return <Navigate to={isStaff ? "/staff/chat" : "/employee/chat"} replace />;
}