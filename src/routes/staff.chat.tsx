import { createFileRoute } from "@tanstack/react-router";
import { EmployeeChatPage } from "@/routes/employee.chat";

export const Route = createFileRoute("/staff/chat")({
  component: StaffChatPage,
});

function StaffChatPage() {
  return <EmployeeChatPage />;
}
