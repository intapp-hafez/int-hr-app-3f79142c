import { useState } from "react";
import { ScanFace, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNotificationPrefs, CATEGORY_META, CHANNEL_META } from "@/lib/notification-prefs";

/** Lets an employee choose which face-enrollment alerts they get, and on which channels. */
export function FaceAlertPrefsCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { prefs, update } = useNotificationPrefs();
  const items = CATEGORY_META.filter((c) => c.group === "biometrics");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-start transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
            <ScanFace className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Face enrollment alerts</p>
            <p className="text-[11px] text-muted-foreground">Choose which alerts you get and how they reach you.</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="hidden grid-cols-[1fr_repeat(3,70px)] gap-2 bg-muted/40 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Alert</span>
            {CHANNEL_META.map((c) => <span key={c.id} className="text-center">{c.label}</span>)}
          </div>
          <ul className="divide-y divide-border">
            {items.map((cat) => (
              <li key={cat.id} className="grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_repeat(3,70px)]">
                <div>
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground">{cat.description}</p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:contents">
                  {CHANNEL_META.map((ch) => (
                    <label key={ch.id} className="flex items-center justify-center gap-2">
                      <span className="text-[10px] uppercase text-muted-foreground sm:hidden">{ch.label}</span>
                      <Switch
                        checked={prefs[cat.id]?.[ch.id] ?? false}
                        onCheckedChange={(v) => update(cat.id, ch.id, v)}
                        aria-label={`${cat.label} via ${ch.label}`}
                      />
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
