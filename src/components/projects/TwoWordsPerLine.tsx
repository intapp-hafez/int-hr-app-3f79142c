import React from "react";
import { cn } from "@/lib/utils";

interface TwoWordsPerLineProps {
  text?: string | null;
  className?: string;
  lineClassName?: string;
}

export function TwoWordsPerLine({ text, className, lineClassName }: TwoWordsPerLineProps) {
  if (!text) return null;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return (
      <span className={cn("font-medium text-foreground whitespace-nowrap", className, lineClassName)}>
        {text}
      </span>
    );
  }
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += 2) {
    lines.push(words.slice(i, i + 2).join(" "));
  }
  return (
    <div className={cn("flex flex-col leading-tight", className)}>
      {lines.map((line, idx) => (
        <span key={idx} className={cn("font-medium text-foreground whitespace-nowrap", lineClassName)}>
          {line}
        </span>
      ))}
    </div>
  );
}

