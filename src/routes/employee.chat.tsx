import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquare,
  Send,
  Building2,
  Radio,
  User,
  ArrowLeft,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  listMyChannels,
  getChannelMessages,
  sendMessage,
  type ChatChannelItem,
} from "@/backend/functions/chat.functions";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/employee/chat")({
  component: EmployeeChatPage,
});

function EmployeeChatPage() {
  const { t } = useI18n();
  const session = useSession();
  const qc = useQueryClient();

  const listChannelsFn = useServerFn(listMyChannels);
  const getMessagesFn = useServerFn(getChannelMessages);
  const sendMsgFn = useServerFn(sendMessage);

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Poll channels every 5s
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["employee-chat-channels"],
    queryFn: () => listChannelsFn(),
    refetchInterval: 5000,
  });

  // Poll messages every 3s
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["chat-messages", activeChannelId],
    queryFn: () => (activeChannelId ? getMessagesFn({ data: { channelId: activeChannelId } }) : Promise.resolve([])),
    enabled: !!activeChannelId,
    refetchInterval: 3000,
  });

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Scroll to bottom on new message
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !activeChannelId || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);

    try {
      await sendMsgFn({ data: { channelId: activeChannelId, content: text } });
      qc.invalidateQueries({ queryKey: ["chat-messages", activeChannelId] });
      qc.invalidateQueries({ queryKey: ["employee-chat-channels"] });
      qc.invalidateQueries({ queryKey: ["my-chat-unread"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message");
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // If in active channel, show conversation view
  if (activeChannel) {
    const isDept = activeChannel.type === "department";
    const isBroadcast = activeChannel.type === "broadcast";

    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveChannelId(null)}
              className="rounded-xl p-1 text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative">
              {isDept ? (
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <Building2 className="h-5 w-5" />
                </div>
              ) : isBroadcast ? (
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-500/10 text-sky-600">
                  <Radio className="h-5 w-5" />
                </div>
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/10 font-semibold text-brand">
                  {activeChannel.recipient?.name?.slice(0, 2).toUpperCase() || <User className="h-5 w-5" />}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">{activeChannel.name}</h2>
              <p className="text-[10px] text-muted-foreground">
                {isDept
                  ? "Department Group Chat"
                  : isBroadcast
                  ? "Company Announcements"
                  : "Direct Chat with Admin"}
              </p>
            </div>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
          {messagesLoading && messages.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading messages…</div>
          )}
          {!messagesLoading && messages.length === 0 && (
            <div className="my-auto flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
              <Sparkles className="mb-2 h-8 w-8 text-brand/40" />
              <p className="font-medium text-foreground">Welcome to {activeChannel.name}</p>
              <p className="mt-1">Messages sent here are visible to the channel participants.</p>
            </div>
          )}
          {messages.map((m) => {
            const isMine = m.is_mine;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
              >
                {!isMine && (
                  <span className="mb-1 ms-1 text-[10px] font-semibold text-muted-foreground">
                    {m.sender_name} {m.sender_role ? `(${m.sender_role})` : ""}
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs ${
                    isMine
                      ? "bg-gradient-brand text-brand-foreground shadow-brand"
                      : "border border-border bg-card text-foreground shadow-soft"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                      isMine ? "text-brand-foreground/75" : "text-muted-foreground"
                    }`}
                  >
                    <span>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isMine && <CheckCheck className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-border bg-card p-2.5">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 focus-within:border-brand">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 max-h-24 min-h-[34px] resize-none bg-transparent px-2.5 py-1 text-xs outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground transition-transform active:scale-95 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Channels List View
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Messages & Chat</h1>
        <p className="text-xs text-muted-foreground">Direct chat with admin, department team, and announcements.</p>
      </div>

      <div className="rounded-3xl border border-border bg-card overflow-hidden divide-y divide-border/40 shadow-soft">
        {channelsLoading && (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading channels…</div>
        )}
        {!channelsLoading && channels.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            No chat channels yet.
          </div>
        )}
        {channels.map((c) => {
          const isDept = c.type === "department";
          const isBroadcast = c.type === "broadcast";

          return (
            <button
              key={c.id}
              onClick={() => setActiveChannelId(c.id)}
              className="flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-muted/40"
            >
              <div className="relative shrink-0">
                {isDept ? (
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                ) : isBroadcast ? (
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500/10 text-sky-600">
                    <Radio className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/10 font-semibold text-brand">
                    {c.recipient?.name?.slice(0, 2).toUpperCase() || <User className="h-5 w-5" />}
                  </div>
                )}
                {c.unread_count > 0 && (
                  <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground shadow-sm">
                    {c.unread_count}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {c.last_message?.created_at
                      ? new Date(c.last_message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>

                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {isDept && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-medium text-amber-600">
                      Department Group
                    </span>
                  )}
                  {isBroadcast && (
                    <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[9px] font-medium text-sky-600">
                      Announcement
                    </span>
                  )}
                  {!isDept && !isBroadcast && (
                    <span className="rounded bg-brand/10 px-1.5 py-0.2 text-[9px] font-medium text-brand">
                      Direct Support
                    </span>
                  )}
                </div>

                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {c.last_message?.content || "No messages yet"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
