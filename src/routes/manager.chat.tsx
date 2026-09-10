import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat/ChatView";

export const Route = createFileRoute("/manager/chat")({
  component: ManagerChatPage,
});

function ManagerChatPage() {
  return <ChatView mode="manager" />;
}
