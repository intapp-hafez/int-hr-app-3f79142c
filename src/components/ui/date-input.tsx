import * as React from "react";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { isoToDmy, dmyToIso, shiftIsoDate } from "@/lib/date-format";



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

  showSteppers?: boolean;

  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;

}



/**

 * Locale-independent date field: always types/displays dd-mm-yyyy,

 * while storing and emitting ISO yyyy-mm-dd. A native date picker is

 * available through clicking the field or the calendar button for quick selection.

 */

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput(

  {

    value,

    onChange,

    min,

    max,

    required,

    disabled,

    name,

    id,

    className,

    placeholder = "dd-mm-yyyy",

    showSteppers,

    onKeyDown,

    ...rest

  },

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



  function step(days: number) {

    if (disabled) return;

    const next = shiftIsoDate(value, days);

    if (min && next < min) return;

    if (max && next > max) return;

    onChange(next);

  }



  const inputNode = (

    <div className={cn("relative inline-flex items-center", className || "w-full")}>

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

        onClick={() => openPicker()}

        onKeyDown={(e) => {

          if (e.key === "ArrowUp") {

            e.preventDefault();

            step(1);

          } else if (e.key === "ArrowDown") {

            e.preventDefault();

            step(-1);

          }

          onKeyDown?.(e);

        }}

        onBlur={() => setText(isoToDmy(value))}

        className="h-10 w-full rounded-xl border border-input bg-background ps-3 pe-9 py-2 text-sm font-mono tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"

        {...rest}

      />

      {/* hidden value carrier for native form submissions */}

      {name ? <input type="hidden" name={name} value={value} /> : null}



      {/* Visual calendar button */}

      <button

        type="button"

        tabIndex={-1}

        aria-label="Open date picker"

        onClick={(e) => {

          e.preventDefault();

          e.stopPropagation();

          openPicker();

        }}

        disabled={disabled}

        className="pointer-events-none absolute end-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"

      >

        <CalendarDays className="h-4 w-4" />

      </button>



      {/* Native date picker element covering the calendar icon area for direct native clicks */}

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

        onClick={(e) => {

          e.stopPropagation();

          try {

            (e.currentTarget as unknown as { showPicker?: () => void }).showPicker?.();

          } catch {

            /* ignore */

          }

        }}

        className="absolute end-0 top-0 h-full w-9 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"

      />

    </div>

  );



  if (!showSteppers) {

    return inputNode;

  }



  return (

    <div className="inline-flex items-center gap-1">

      <button

        type="button"

        tabIndex={-1}

        aria-label="Previous day"

        title="Previous day"

        onClick={(e) => {

          e.preventDefault();

          e.stopPropagation();

          step(-1);

        }}

        disabled={disabled || (min ? value <= min : false)}

        className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"

      >

        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />

      </button>

      {inputNode}

      <button

        type="button"

        tabIndex={-1}

        aria-label="Next day"

        title="Next day"

        onClick={(e) => {

          e.preventDefault();

          e.stopPropagation();

          step(1);

        }}

        disabled={disabled || (max ? value >= max : false)}

        className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"

      >

        <ChevronRight className="h-4 w-4 rtl:rotate-180" />

      </button>

    </div>

  );

});



export interface DateRangeFieldProps {

  from: string;

  to: string;

  onFromChange: (iso: string) => void;

  onToChange: (iso: string) => void;

  fromLabel?: string;

  toLabel?: string;

  error?: string | null;

  helper?: string;

  className?: string;

  disabled?: boolean;

}



/**

 * Unified date-range filter: identical labels, placeholders and helper text

 * everywhere (Leaves, Attendance, Holidays, Reports). Values are ISO,

 * display is always dd-mm-yyyy.

 */

export function DateRangeField({

  from,

  to,

  onFromChange,

  onToChange,

  fromLabel = "From",

  toLabel = "To",

  error,

  helper = "Format: dd-mm-yyyy",

  className,

  disabled,

}: DateRangeFieldProps) {

  return (

    <div className={cn("w-full space-y-1", className)}>

      <div className="grid grid-cols-2 gap-2">

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">

          <span>{fromLabel} (dd-mm-yyyy)</span>

          <DateInput value={from} onChange={onFromChange} max={to || undefined} disabled={disabled} aria-label={`${fromLabel} date (dd-mm-yyyy)`} />

        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">

          <span>{toLabel} (dd-mm-yyyy)</span>

          <DateInput value={to} onChange={onToChange} min={from || undefined} disabled={disabled} aria-label={`${toLabel} date (dd-mm-yyyy)`} />

        </label>

      </div>

      {error ? (

        <p className="text-xs font-medium text-destructive">{error}</p>

      ) : (

        <p className="text-[11px] text-muted-foreground">{helper}</p>

      )}

    </div>

  );

}

