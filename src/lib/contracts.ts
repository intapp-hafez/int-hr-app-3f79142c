import { getState } from "./store";

const DAY = 86_400_000;

function seedFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable mock contract dates derived from employee id + optional contract type. */
export function deriveBaseContract(empId: string, contractType?: string) {
  const seed = seedFromId(empId);
  const startOffsetMonths = 6 + (seed % 25);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - startOffsetMonths);
  start.setDate(1 + (seed % 27));
  const months =
    contractType === "Internship" || contractType === "Temporary"
      ? 6
      : seed % 2 === 0
        ? 12
        : 24;
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return { start, end };
}

export type ContractInfo = {
  start: Date;
  end: Date;
  remaining: number; // whole days; 0 = ends today, negative = expired
  cancelled: boolean;
};

/** Returns contract info, applying any store override (renewals / cancellations). */
export function getContractInfo(empId: string, contractType?: string): ContractInfo {
  const { start, end } = deriveBaseContract(empId, contractType);
  const override = getState().contractOverrides?.[empId];
  const finalStart = override?.start ? new Date(override.start) : start;
  const finalEnd = override?.end ? new Date(override.end) : end;
  return {
    start: finalStart,
    end: finalEnd,
    remaining: daysBetween(new Date(), finalEnd),
    cancelled: override?.status === "cancelled",
  };
}

/** Whole-day difference, midnight-anchored — works for same-day end dates. */
export function daysBetween(from: Date, to: Date) {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to);   b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}