import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoToDmy, dmyToIso } from "@/lib/date-format";

export interface DateInputProps {
  /** ISO value: yyyy-mm-dd (empty string when unset) */
  value: string;
  onChange: (isoValue: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
  placeholder?: string;
}

/**
 * Locale-independent date field: always types/displays dd-mm-yyyy,
 * while storing and emitting ISO yyyy-mm-dd. A native date picker is
 * available through the calendar button for quick selection.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onChange, min, max, required, disabled, name, id, className, placeholder = "dd-mm-yyyy", ...rest },
  ref,
) {
  const [text, setText] = React.useState(() => isoToDmy(value));
  const pickerRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // keep in sync when the ISO value changes from outside
    if (dmyToIso(text) !== value) setText(isoToDmy(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleText(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    setText(out);
    const iso = dmyToIso(out);
    if (iso) onChange(iso);
    else if (out === "") onChange("");
  }

  function openPicker() {
    const el = pickerRef.current;
    if (!el || disabled) return;
    // showPicker is supported in modern browsers; fall back to focus+click
    if (typeof (el as unknown as { showPicker?: () => void }).showPicker === "function") {
      try {
        (el as unknown as { showPicker: () => void }).showPicker();
        return;
      } catch {
        /* ignore */
      }
    }
    el.focus();
    el.click();
  }

  return (
    <div className={cn("relative inline-flex w-full items-center", className)}>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        required={required}
        disabled={disabled}
        onChange={(e) => handleText(e.target.value)}
        onBlur={() => setText(isoToDmy(value))}
        className="h-10 w-full rounded-xl border border-input bg-background px-3 pr-9 py-2 text-sm font-mono tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      />
      {/* hidden value carrier for native form submissions */}
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open date picker"
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ""}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute right-2 bottom-0 h-0 w-0 opacity-0"
      />
    </div>
  );
});
