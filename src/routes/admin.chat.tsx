import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat/ChatView";

export const Route = createFileRoute("/admin/chat")({
  component: AdminChatPage,
});

function AdminChatPage() {
  return <ChatView mode="admin" />;
}
