import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VALID_CONTRACT_TYPES = ["FullTime", "PartTime", "Temporary", "Internship", "Probation3M"] as const;


const VALID_SALARY_MODES = ["gross", "net"] as const;
const VALID_TARGET_DURATIONS = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"] as const;
const ID_PATTERN = /^INT-\d{3,6}$/;

function isStrictIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

const EmployeeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  dept: z.string().trim().min(1).max(80),
  contractType: z.enum(VALID_CONTRACT_TYPES),
  salaryMode: z.enum(VALID_SALARY_MODES),
  targetDuration: z.enum(VALID_TARGET_DURATIONS),
  manager: z.string().trim().max(16).optional().default(""),
  managerIds: z.array(z.string()).optional().default([]),
  nationalId: z.string().trim().max(32).optional().default(""),
  nationalIdExpiry: z.string().trim().max(10).optional().default(""),
}).superRefine((v, ctx) => {
  if (v.manager && !ID_PATTERN.test(v.manager)) {
    ctx.addIssue({ code: "custom", path: ["manager"], message: "managerInvalid" });
  }
  if (v.manager && v.managerIds.length && !v.managerIds.includes(v.manager)) {
    ctx.addIssue({ code: "custom", path: ["manager"], message: "managerInvalid" });
  }
  if (v.nationalId) {
    if (!v.nationalIdExpiry) {
      ctx.addIssue({ code: "custom", path: ["nationalIdExpiry"], message: "idExpiryRequired" });
      return;
    }
    if (!isStrictIsoDate(v.nationalIdExpiry)) {
      ctx.addIssue({ code: "custom", path: ["nationalIdExpiry"], message: "idExpiryInvalid" });
      return;
    }
    const [year, month, day] = v.nationalIdExpiry.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d.getTime() < today.getTime()) {
      ctx.addIssue({ code: "custom", path: ["nationalIdExpiry"], message: "idExpiryInPast" });
    }
  }
});

const BatchSchema = z.object({
  employees: z.array(z.unknown()).min(1).max(1000),
  managerIds: z.array(z.string()).optional().default([]),
});

const RehireSchema = z.object({
  employeeId: z.string().regex(/^INT-\d{3,6}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contractType: z.enum(VALID_CONTRACT_TYPES),
  salaryMode: z.enum(VALID_SALARY_MODES),
  salary: z.number().positive().max(10_000_000),
  position: z.string().trim().min(1).max(80),
  currentContractEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  currentContractCancelled: z.boolean().optional().default(false),
});

export type EmployeeValidationResult = {
  index: number;
  ok: boolean;
  error?: string;
  field?: string;
};

function validateOne(input: unknown, managerIds: string[]): EmployeeValidationResult {
  const raw = (input ?? {}) as Record<string, unknown>;
  const candidate = { ...raw, managerIds };
  const parsed = EmployeeSchema.safeParse(candidate);
  if (parsed.success) return { index: -1, ok: true };
  const first = parsed.error.issues[0];
  return {
    index: -1,
    ok: false,
    error: first.message,
    field: String(first.path[0] ?? ""),
  };
}

/** Server-side validation for HR rules (ID expiry, dept, manager, salary mode, contract type). */
export const validateEmployeesBatch = createServerFn({ method: "POST" })
  .inputValidator((data) => BatchSchema.parse(data))
  .handler(async ({ data }) => {
    const results: EmployeeValidationResult[] = data.employees.map((emp, i) => ({
      ...validateOne(emp, data.managerIds),
      index: i,
    }));
    const okCount = results.filter((r) => r.ok).length;
    return {
      ok: okCount === results.length,
      total: results.length,
      okCount,
      results,
    };
  });

/**
 * Server-side rehire validation — prevents overlapping contracts. Rehire is
 * only allowed when the existing contract is cancelled OR already expired
 * (currentContractEnd < newStartDate).
 */
export const validateRehire = createServerFn({ method: "POST" })
  .inputValidator((data) => RehireSchema.parse(data))
  .handler(async ({ data }) => {
    const newStart = new Date(data.startDate + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (newStart.getTime() < today.getTime()) {
      return { ok: false as const, error: "rehireStartInPast" };
    }
    if (data.currentContractCancelled) {
      return { ok: true as const };
    }
    if (data.currentContractEnd) {
      const curEnd = new Date(data.currentContractEnd + "T00:00:00");
      if (curEnd.getTime() >= newStart.getTime()) {
        return { ok: false as const, error: "rehireOverlap" };
      }
    }
    return { ok: true as const };
  });