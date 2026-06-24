/**
 * Shared Gross ↔ Net salary helper used by both the Add and Edit employee
 * forms so the two screens never drift apart.
 *
 * NOTE: This is a UI-side estimate (flat 10% delta) for live form preview.
 * The authoritative computation is the Egyptian payroll engine in
 * `src/lib/payroll-engine.ts`, invoked server-side at payroll time.
 */
export const SALARY_NET_RATIO = 0.9;

export type SalaryMode = "gross" | "net";

/** Estimate net from gross. */
export function netFromGross(gross: number): number {
  if (!gross || gross <= 0) return 0;
  return Math.round(gross * SALARY_NET_RATIO);
}

/** Estimate gross from net. */
export function grossFromNet(net: number): number {
  if (!net || net <= 0) return 0;
  return Math.round(net / SALARY_NET_RATIO);
}

/** Given the value the user typed and which field they edited, return both. */
export function computeSalaryPair(
  value: number,
  edited: SalaryMode,
): { gross: number; net: number } {
  const n = Number.isFinite(value) ? value : 0;
  if (edited === "gross") return { gross: n, net: netFromGross(n) };
  return { gross: grossFromNet(n), net: n };
}