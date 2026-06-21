import { useStore } from "./store";

// Roles that are allowed to see unmasked sensitive PII (national ID, full passport).
const SENSITIVE_ROLES = new Set(["admin", "hr"]);

export type ViewerRole = "admin" | "hr" | "manager" | "employee";

// In a real app this would come from the authenticated session.
// The admin panel runs as an admin, so default to "admin"; this hook
// is the single choke-point so it can be swapped to a real auth check.
export function useViewerRole(): ViewerRole {
  return useStore(() => "admin" as ViewerRole);
}

export function canViewSensitive(role: ViewerRole): boolean {
  return SENSITIVE_ROLES.has(role);
}

/** Masks all but the last 4 characters: 29801011200345 → ••••••••••0345 */
export function maskSensitive(value: string | undefined | null, visible = 4): string {
  if (!value) return "—";
  const v = String(value);
  if (v.length <= visible) return "•".repeat(Math.max(0, v.length - 1)) + v.slice(-1);
  return "•".repeat(v.length - visible) + v.slice(-visible);
}