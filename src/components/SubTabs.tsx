import { Link, useRouterState } from "@tanstack/react-router";

export function SubTabs({ items }: { items: { to: string; label: string }[] }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1 w-fit">
      {items.map((it) => {
        const active = path === it.to || path.startsWith(it.to + "/");
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}