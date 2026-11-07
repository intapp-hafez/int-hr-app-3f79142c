import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { Search, ChevronDown, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ManagerOption {
  id?: string;
  name: string;
  department?: string;
  role?: string;
  avatarUrl?: string | null;
}

interface SearchableManagerSelectProps {
  value: string;
  onChange: (selected: ManagerOption) => void;
  options: ManagerOption[];
  placeholder?: string;
  isAr?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SearchableManagerSelect({
  value,
  onChange,
  options,
  placeholder = "Select manager...",
  isAr = false,
  disabled = false,
  className,
}: SearchableManagerSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedManager = useMemo(() => {
    return options.find((m) => m.name === value || m.id === value) || (value ? { name: value } : null);
  }, [options, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.department && m.department.toLowerCase().includes(q)) ||
        (m.role && m.role.toLowerCase().includes(q))
    );
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-10 justify-between text-left font-normal rounded-xl border-input bg-background hover:bg-muted/30 px-3 text-xs shadow-2xs",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedManager ? (
              <>
                <EmployeeAvatar
                  id={selectedManager.id || selectedManager.name}
                  name={selectedManager.name}
                  url={selectedManager.avatarUrl}
                  className="h-6 w-6 rounded-full shrink-0"
                  fallbackClassName="text-[9px]"
                />
                <span className="font-medium text-foreground truncate">
                  {selectedManager.name}
                  {selectedManager.department ? (
                    <span className="text-muted-foreground ml-1.5 text-[11px] font-normal">
                      ({selectedManager.department})
                    </span>
                  ) : null}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {placeholder}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 opacity-70 ml-2" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions={false}
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-2 rounded-2xl shadow-xl border border-border bg-popover z-50 animate-in fade-in-50 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
      >
        <div className="p-1.5 border-b border-border/50 flex items-center gap-2 mb-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder={isAr ? "بحث بالاسم أو الإدارة..." : "Search by name or department..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs px-1"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1"
            >
              {isAr ? "مسح" : "Clear"}
            </button>
          )}
        </div>

        <div className="max-h-60 overflow-y-auto divide-y divide-border/30">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-xs">
              {isAr ? "لا يوجد مدراء مطابقون للبحث" : "No managers match search"}
            </div>
          ) : (
            filtered.map((m) => {
              const isSelected = selectedManager?.name === m.name || selectedManager?.id === m.id;
              return (
                <div
                  key={m.id || m.name}
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-xs",
                    isSelected
                      ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <EmployeeAvatar
                      id={m.id || m.name}
                      name={m.name}
                      url={m.avatarUrl}
                      className="h-7 w-7 rounded-full shrink-0"
                      fallbackClassName="text-[10px]"
                    />
                    <div className="truncate">
                      <p className="truncate font-medium">{m.name}</p>
                      {m.department && (
                        <p className="text-[10px] text-muted-foreground truncate">{m.department}</p>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
