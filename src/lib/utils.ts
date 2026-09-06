import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeRandomUUID(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fallback
  }
  return "fld_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 11);
}

/** Break a full name into lines of up to 3 words each */
export function formatName3Words(name?: string | null): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  if (words.length <= 3) return name;
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += 3) {
    lines.push(words.slice(i, i + 3).join(" "));
  }
  return lines.join("\n");
}

