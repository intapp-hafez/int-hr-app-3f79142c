import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquare,
  Send,
  Plus,
  Search,
  Users,
  Building2,
  Radio,
  User,
  CheckCheck,
  Check,
  ArrowLeft,
  Sparkles,
  Smile,
  Paperclip,
  Clock,
  ShieldAlert,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  listMyChannels,
  getChannelMessages,
  sendMessage,
  sendGroupOrDirectMessage,
  listChatTargets,
  type ChatChannelItem,
  type ChatMessageItem,
} from "@/backend/functions/chat.functions";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/admin/chat")({
  component: AdminChatPage,
});

type FilterTab = "all" | "direct" | "department" | "broadcast";

function AdminChatPage() {
  const { t } = useI18n();
  const session = useSession();
  const qc = useQueryClient();

  const listChannelsFn = useServerFn(listMyChannels);
  const getMessagesFn = useServerFn(getChannelMessages);
  const sendMsgFn = useServerFn(sendMessage);
  const sendGroupFn = useServerFn(sendGroupOrDirectMessage);
  const listTargetsFn = useServerFn(listChatTargets);

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Channels Query (polls every 5s)
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["chat-channels"],
    queryFn: () => listChannelsFn(),
    refetchInterval: 5000,
  });

  // Active Channel Messages Query (polls every 3s)
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["chat-messages", activeChannelId],
    queryFn: () => (activeChannelId ? getMessagesFn({ data: { channelId: activeChannelId } }) : Promise.resolve([])),
    enabled: !!activeChannelId,
    refetchInterval: 3000,
  });

  // Targets Query (for New Message modal)
  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ["chat-targets"],
    queryFn: () => listTargetsFn(),
    enabled: showNewModal,
  });

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Filter channels
  const filteredChannels = channels.filter((c) => {
    if (filter !== "all" && c.type !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchRecipient = c.recipient?.name?.toLowerCase().includes(q);
      const matchDept = c.department_name?.toLowerCase().includes(q);
      const matchLastMsg = c.last_message?.content?.toLowerCase().includes(q);
      if (!matchName && !matchRecipient && !matchDept && !matchLastMsg) return false;
    }
    return true;
  });

  // Auto-scroll messages to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Send Message in active channel
  const handleSend = async () => {
    if (!draft.trim() || !activeChannelId || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);

    try {
      await sendMsgFn({ data: { channelId: activeChannelId, content: text } });
      qc.invalidateQueries({ queryKey: ["chat-messages", activeChannelId] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
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

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4 overflow-hidden">
      {/* Top Header */}
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Messages & Chat</h1>
          <p className="text-xs text-muted-foreground">
            Direct chat with employees, department broadcasts, and announcements.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-brand transition-all hover:opacity-95 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> New Message
        </button>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        {/* Left Column: Channels List */}
        <div
          className={`flex w-full flex-col border-e border-border lg:w-80 xl:w-96 ${
            activeChannelId ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Search & Filter bar */}
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full rounded-xl border border-border bg-background py-2 ps-9 pe-3 text-xs outline-none focus:border-brand"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto text-xs scrollbar-none">
              {(["all", "direct", "department", "broadcast"] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                    filter === tab
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab === "all" ? "All" : tab === "direct" ? "Direct" : tab === "department" ? "Departments" : "Broadcasts"}
                </button>
              ))}
            </div>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {channelsLoading && (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading chats…</div>
            )}
            {!channelsLoading && filteredChannels.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                No conversations found. Click <strong>New Message</strong> to start a chat or department broadcast.
              </div>
            )}
            {filteredChannels.map((c) => {
              const isSelected = c.id === activeChannelId;
              const isDept = c.type === "department";
              const isBroadcast = c.type === "broadcast";

              return (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={`flex w-full items-start gap-3 p-3.5 text-start transition-colors ${
                    isSelected ? "bg-muted/80" : "hover:bg-muted/30"
                  }`}
                >
                  {/* Avatar or Type Icon */}
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

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="truncate text-xs font-semibold text-foreground">{c.name}</p>
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
                        <span className="rounded bg-amber-500/10 px-1 py-0.2 text-[9px] font-medium text-amber-600">
                          Dept
                        </span>
                      )}
                      {isBroadcast && (
                        <span className="rounded bg-sky-500/10 px-1 py-0.2 text-[9px] font-medium text-sky-600">
                          Broadcast
                        </span>
                      )}
                      {!isDept && !isBroadcast && c.recipient?.department && (
                        <span className="truncate text-[10px] text-muted-foreground/70">
                          {c.recipient.department}
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

        {/* Right Column: Chat Window */}
        <div
          className={`flex flex-1 flex-col bg-background/50 ${
            !activeChannelId ? "hidden lg:flex" : "flex"
          }`}
        >
          {activeChannel ? (
            <>
              {/* Active Channel Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveChannelId(null)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted lg:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    {activeChannel.type === "department" ? (
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                        <Building2 className="h-5 w-5" />
                      </div>
                    ) : activeChannel.type === "broadcast" ? (
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
                    <p className="text-[11px] text-muted-foreground">
                      {activeChannel.type === "department"
                        ? `Department Channel · ${activeChannel.participant_count ?? 0} members`
                        : activeChannel.type === "broadcast"
                        ? "Company-wide Announcement"
                        : activeChannel.recipient?.department || activeChannel.recipient?.email || "Direct Message"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading && messages.length === 0 && (
                  <div className="p-8 text-center text-xs text-muted-foreground">Loading messages…</div>
                )}
                {!messagesLoading && messages.length === 0 && (
                  <div className="my-auto flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                    <Sparkles className="mb-2 h-8 w-8 text-brand/40" />
                    <p className="font-medium text-foreground">Start of conversation</p>
                    <p className="mt-1">Send a message below to communicate with {activeChannel.name}.</p>
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
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:max-w-[70%] ${
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

              {/* Chat Input Bar */}
              <div className="border-t border-border bg-card p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 focus-within:border-brand">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                    rows={1}
                    className="flex-1 max-h-32 min-h-[36px] resize-none bg-transparent px-2.5 py-1.5 text-xs outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground transition-transform active:scale-95 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="my-auto flex flex-col items-center justify-center p-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-brand/10 text-brand">
                <MessageSquare className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-foreground">Select a conversation</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Choose a direct chat or department group from the left, or click <strong>New Message</strong> to broadcast to a department.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Message / Broadcast Modal */}
      {showNewModal && (
        <NewMessageModal
          targets={targets}
          isLoading={targetsLoading}
          onClose={() => setShowNewModal(false)}
          onSuccess={(channelId) => {
            setShowNewModal(false);
            setActiveChannelId(channelId);
            qc.invalidateQueries({ queryKey: ["chat-channels"] });
          }}
          sendGroupFn={sendGroupFn}
        />
      )}
    </div>
  );
}

function SearchableSelectPicker({
  value,
  onChange,
  options,
  placeholder = "Search and select…",
  searchPlaceholder = "Type to search…",
  emptyText = "No matches found",
  isLoading = false,
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{
    id: string;
    title: string;
    subtitle?: string;
    badge?: string;
  }>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  isLoading?: boolean;
  icon?: any;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) {
      setQuery("");
    } else {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = options.filter((o) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      o.title.toLowerCase().includes(q) ||
      (o.subtitle && o.subtitle.toLowerCase().includes(q)) ||
      (o.badge && o.badge.toLowerCase().includes(q))
    );
  });

  return (
    <div ref={containerRef} className="relative mt-1.5">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-background px-3.5 py-2.5 text-start text-xs transition-all ${
          open
            ? "border-brand ring-2 ring-brand/20 shadow-sm"
            : "border-border hover:border-brand/50"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {Icon && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
          {isLoading ? (
            <span className="text-muted-foreground animate-pulse">Loading…</span>
          ) : selectedItem ? (
            <div className="min-w-0 flex-1 flex items-center gap-2">
              <span className="truncate font-semibold text-foreground">{selectedItem.title}</span>
              {selectedItem.badge && (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand truncate">
                  {selectedItem.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-muted-foreground">
          {selectedItem && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {/* Search Input Bar */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1 text-xs">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start transition-colors ${
                      isSelected
                        ? "bg-brand/10 text-brand font-semibold"
                        : "hover:bg-muted/60 text-foreground"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{item.title}</span>
                        {item.badge && (
                          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-brand" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewMessageModal({
  targets,
  isLoading,
  onClose,
  onSuccess,
  sendGroupFn,
}: {
  targets?: {
    departments: Array<{ id: string; name: string; count: number }>;
    employees: Array<{ id: string; name: string; email?: string; department?: string; avatar_url?: string }>;
  };
  isLoading?: boolean;
  onClose: () => void;
  onSuccess: (channelId: string) => void;
  sendGroupFn: any;
}) {
  const [targetType, setTargetType] = useState<"direct" | "department" | "broadcast">("department");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return toast.error("Please enter a message");
    if (targetType !== "broadcast" && !selectedTargetId) {
      return toast.error(`Please select a ${targetType === "department" ? "department" : "user"}`);
    }

    setSubmitting(true);
    try {
      const res: any = await sendGroupFn({
        data: {
          targetType,
          targetId: selectedTargetId || undefined,
          content: content.trim(),
        },
      });
      toast.success(
        targetType === "department"
          ? "Message sent to department members"
          : targetType === "broadcast"
          ? "Broadcast announcement sent"
          : "Direct message sent"
      );
      onSuccess(res.channelId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">New Message / Broadcast</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Type Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Recipient Type</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetType("department");
                  setSelectedTargetId("");
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-all ${
                  targetType === "department"
                    ? "border-brand bg-brand/10 text-brand shadow-sm font-semibold"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Building2 className="h-5 w-5" />
                <span>Department Group</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType("direct");
                  setSelectedTargetId("");
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-all ${
                  targetType === "direct"
                    ? "border-brand bg-brand/10 text-brand shadow-sm font-semibold"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <User className="h-5 w-5" />
                <span>Individual User</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType("broadcast");
                  setSelectedTargetId("");
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-all ${
                  targetType === "broadcast"
                    ? "border-brand bg-brand/10 text-brand shadow-sm font-semibold"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Radio className="h-5 w-5" />
                <span>All Company</span>
              </button>
            </div>
          </div>

          {/* Department Picker */}
          {targetType === "department" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Select Department</label>
              <SearchableSelectPicker
                value={selectedTargetId}
                onChange={setSelectedTargetId}
                isLoading={isLoading}
                placeholder="— Select a department to group message —"
                searchPlaceholder="Search departments…"
                emptyText="No departments found"
                icon={Building2}
                options={(targets?.departments ?? []).map((d) => ({
                  id: d.id,
                  title: d.name,
                  subtitle: `${d.count} members`,
                }))}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                All employees assigned to this department will receive this message in their department chat.
              </p>
            </div>
          )}

          {/* Employee Picker */}
          {targetType === "direct" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Select Employee</label>
              <SearchableSelectPicker
                value={selectedTargetId}
                onChange={setSelectedTargetId}
                isLoading={isLoading}
                placeholder="— Choose an employee —"
                searchPlaceholder="Search employee by name, email, or department…"
                emptyText="No active employees found"
                icon={User}
                options={(targets?.employees ?? []).map((emp) => ({
                  id: emp.id,
                  title: emp.name,
                  subtitle: emp.email,
                  badge: emp.department,
                }))}
              />
            </div>
          )}

          {/* Broadcast Note */}
          {targetType === "broadcast" && (
            <div className="rounded-2xl bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
              This message will be broadcast to all company staff in the <strong>Company Announcements</strong> channel.
            </div>
          )}

          {/* Message Content */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Message</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={4}
              placeholder="Write your message here…"
              className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-brand"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-5 py-2 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Sending…" : "Send Message"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
