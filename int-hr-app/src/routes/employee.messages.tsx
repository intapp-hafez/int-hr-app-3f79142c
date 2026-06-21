import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { useI18n, useTranslators } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDeliveries } from "@/backend/functions/notifications.functions";

export const Route = createFileRoute("/employee/messages")({
  component: MessagesPage,
});

function previewFor(d: any): string {
  const p = d.payload ?? {};
  if (typeof p === "string") return p;
  if (p.body) return String(p.body);
  if (p.message) return String(p.message);
  if (p.preview) return String(p.preview);
  if (p.kind === "leave_decision") {
    const status = p.status ?? "updated";
    const label = p.leave_type_name ?? "Leave";
    return `${label} request ${status} for ${p.start_date ?? ""}${p.end_date && p.end_date !== p.start_date ? ` → ${p.end_date}` : ""}.`;
  }
  return d.subject ?? "";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

function MessagesPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const listFn = useServerFn(listMyDeliveries);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-deliveries"],
    queryFn: () => listFn(),
  });

  const messages = (rows as any[]).map((d) => ({
    id: d.id as string,
    subject: (d.subject ?? "Notification") as string,
    preview: previewFor(d),
    channel: (d.channel ?? "inapp") as string,
    status: (d.status ?? "") as string,
    created_at: d.created_at as string,
    time: timeAgo(d.created_at),
  }));

  const q2 = q.toLowerCase();
  const filtered = messages.filter((m) =>
    m.subject.toLowerCase().includes(q2) || m.preview.toLowerCase().includes(q2),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("messages")}</h1>
          <p className="text-xs text-muted-foreground">{messages.length} {t("messages").toLowerCase()}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchMessages")}
          className="w-full rounded-2xl border border-border bg-card py-2.5 ps-9 pe-3 text-sm outline-none focus:border-brand"
        />
      </div>

      <ul className="space-y-2">
        {isLoading && (
          <li className="rounded-2xl border border-border bg-card p-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          </li>
        )}
        {!isLoading && filtered.map((m) => {
          const initials = m.subject.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
          return (
            <li
              key={m.id}
              className="flex gap-3 rounded-2xl border border-border bg-card p-4 transition-colors"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-brand text-sm font-semibold text-brand-foreground">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.subject}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.channel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{m.time}</span>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.preview}</p>
              </div>
            </li>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <li className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 py-10 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{t("noMessages")}</p>
          </li>
        )}
      </ul>
    </div>
  );
}