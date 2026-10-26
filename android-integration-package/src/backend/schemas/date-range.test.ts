import { describe, it, expect } from "vitest";
import {
  checkDateRange,
  dateRangeSchema,
  isoDateSchema,
  startEndRangeSchema,
} from "./date-range";
import { LeaveSubmitSchema } from "./index";
import { parseInput } from "./validation-error";
import { parseValidationError, fieldError } from "@/lib/validation-error";

const parseErr = (schema: any, input: unknown): string => {
  const res = schema.safeParse(input);
  expect(res.success).toBe(false);
  return res.error.issues.map((i: any) => i.message).join(" | ");
};

describe("checkDateRange", () => {
  it("accepts a valid in-order range", () => {
    expect(checkDateRange("2026-08-01", "2026-08-10")).toBeNull();
  });

  it("accepts the same day for from and to", () => {
    expect(checkDateRange("2026-08-01", "2026-08-01")).toBeNull();
  });

  it("rejects out-of-order dates with a dd-mm-yyyy message", () => {
    expect(checkDateRange("2026-08-30", "2026-08-25")).toBe(
      "To date (25-08-2026) must be on or after from date (30-08-2026).",
    );
  });

  it("rejects missing dates", () => {
    expect(checkDateRange("", "")).toBe("From and To dates are required (dd-mm-yyyy).");
    expect(checkDateRange("2026-08-01", null)).toBe("To date is required (dd-mm-yyyy).");
    expect(checkDateRange(null, "2026-08-01")).toBe("From date is required (dd-mm-yyyy).");
  });

  it("allows both missing when optional", () => {
    expect(checkDateRange(null, null, { optional: true })).toBeNull();
  });

  it("rejects impossible calendar dates", () => {
    expect(checkDateRange("2026-02-30", "2026-03-01")).toBe(
      "From date is not a valid date (dd-mm-yyyy).",
    );
  });

  it("enforces maxDays with a dd-mm-yyyy message", () => {
    expect(checkDateRange("2026-01-01", "2026-01-11", { maxDays: 10 })).toBe(
      "Range 01-01-2026 → 11-01-2026 is longer than 10 days.",
    );
  });
});

describe("isoDateSchema", () => {
  it("rejects dd-mm-yyyy input", () => {
    expect(parseErr(isoDateSchema("Holiday"), "01-08-2026")).toContain(
      "Holiday must be a valid date (dd-mm-yyyy).",
    );
  });
  it("accepts ISO input", () => {
    expect(isoDateSchema().parse("2026-08-01")).toBe("2026-08-01");
  });
});

describe("dateRangeSchema (attendance / activity / holiday filters)", () => {
  const schema = dateRangeSchema({ maxDays: 366 });

  it("accepts a valid filter", () => {
    expect(schema.parse({ from: "2026-08-01", to: "2026-08-31" })).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("rejects a missing to date", () => {
    expect(parseErr(schema, { from: "2026-08-01" })).toMatch(/Required|invalid|expected/i);
  });

  it("rejects an out-of-order range", () => {
    expect(parseErr(schema, { from: "2026-08-31", to: "2026-08-01" })).toBe(
      "To date (01-08-2026) must be on or after from date (31-08-2026).",
    );
  });

  it("rejects a malformed date", () => {
    expect(parseErr(schema, { from: "31-08-2026", to: "2026-09-01" })).toContain(
      "From must be a valid date (dd-mm-yyyy).",
    );
  });

  it("rejects ranges longer than the cap", () => {
    expect(parseErr(schema, { from: "2024-01-01", to: "2026-01-01" })).toContain(
      "is longer than 366 days.",
    );
  });
});

describe("startEndRangeSchema (holiday / leave records)", () => {
  const schema = startEndRangeSchema();
  it("accepts a valid record range", () => {
    expect(() => schema.parse({ start_date: "2026-06-11", end_date: "2026-06-25" })).not.toThrow();
  });
  it("rejects reversed records", () => {
    expect(parseErr(schema, { start_date: "2026-06-25", end_date: "2026-06-11" })).toBe(
      "End date (11-06-2026) must be on or after start date (25-06-2026).",
    );
  });
});

describe("LeaveSubmitSchema", () => {
  const base = { days: 3, paid: true };

  it("accepts a valid leave request", () => {
    expect(() =>
      LeaveSubmitSchema.parse({ ...base, start_date: "2026-08-14", end_date: "2026-08-17" }),
    ).not.toThrow();
  });

  it("rejects an end date before the start date", () => {
    expect(
      parseErr(LeaveSubmitSchema, { ...base, start_date: "2026-08-17", end_date: "2026-08-14" }),
    ).toBe("End date (14-08-2026) must be on or after start date (17-08-2026).");
  });

  it("rejects a missing end date", () => {
    expect(parseErr(LeaveSubmitSchema, { ...base, start_date: "2026-08-14" })).toBeTruthy();
  });

  it("rejects an invalid calendar date", () => {
    expect(
      parseErr(LeaveSubmitSchema, { ...base, start_date: "2026-02-30", end_date: "2026-03-02" }),
    ).toContain("Start must be a valid date (dd-mm-yyyy).");
  });
});

describe("unified validation payload", () => {
  const rangeSchema = dateRangeSchema({ maxDays: 366 });

  function capture(fn: () => unknown) {
    try {
      fn();
      return null;
    } catch (e) {
      return parseValidationError(e);
    }
  }

  it("tags the payload and maps messages to fields", () => {
    const parsed = capture(() => parseInput(rangeSchema, { from: "2026-05-01", to: "2026-04-01" }))!;
    expect(parsed.structured).toBe(true);
    expect(parsed.message).toMatch(/\d{2}-\d{2}-\d{4}/);
    expect(fieldError(parsed, "to")).toBeTruthy();
  });

  it("reports missing dates per field", () => {
    const parsed = capture(() => parseInput(rangeSchema, {}))!;
    expect(parsed.structured).toBe(true);
    expect(Object.keys(parsed.fieldErrors).sort()).toEqual(["from", "to"]);
  });

  it("rejects malformed dates with dd-mm-yyyy guidance", () => {
    const parsed = capture(() => parseInput(rangeSchema, { from: "01-05-2026", to: "2026-05-02" }))!;
    expect(fieldError(parsed, "from")).toMatch(/dd-mm-yyyy/i);
  });

  it("applies field aliases", () => {
    const parsed = capture(() =>
      parseInput(startEndRangeSchema(), { start_date: "2026-05-10", end_date: "2026-05-01" }, {
        fieldAliases: { start_date: "from", end_date: "to" },
      }),
    )!;
    expect(fieldError(parsed, "to", "end_date")).toBeTruthy();
  });
});
