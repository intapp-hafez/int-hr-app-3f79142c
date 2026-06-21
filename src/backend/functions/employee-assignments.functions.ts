import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

const KIND_TABLE = {
  kpi: { table: "employee_kpis", col: "kpi_id" },
  allowance: { table: "employee_allowances", col: "allowance_id" },
  targets_overtime: { table: "employee_targets_overtime", col: "targets_overtime_id" },
  shift: { table: "employee_shifts", col: "shift_id" },
} as const;

type Kind = keyof typeof KIND_TABLE;
const KindEnum = z.enum(["kpi", "allowance", "targets_overtime", "shift"]);

export const listEmployeeAssignments = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ employee_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const out: Record<Kind, string[]> = { kpi: [], allowance: [], targets_overtime: [], shift: [] };
    for (const kind of Object.keys(KIND_TABLE) as Kind[]) {
      const { table, col } = KIND_TABLE[kind];
      const { data: rows, error } = await context.supabase
        .from(table)
        .select(col)
        .eq("employee_id", data.employee_id);
      if (error) throw new Error(error.message);
      out[kind] = (rows ?? []).map((r: any) => r[col] as string);
    }
    return out;
  });

export const setEmployeeAssignments = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        employee_id: z.string().uuid(),
        kind: KindEnum,
        ids: z.array(z.string().uuid()),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { table, col } = KIND_TABLE[data.kind as Kind];
    const { error: delErr } = await context.supabase
      .from(table)
      .delete()
      .eq("employee_id", data.employee_id);
    if (delErr) throw new Error(delErr.message);
    if (data.ids.length > 0) {
      const rows = data.ids.map((id) => ({ employee_id: data.employee_id, [col]: id }));
      const { error: insErr } = await context.supabase.from(table).insert(rows as any);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

export const bulkAssignToEmployees = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        employee_ids: z.array(z.string().uuid()).min(1),
        assignments: z
          .object({
            kpi: z.array(z.string().uuid()).optional().default([]),
            allowance: z.array(z.string().uuid()).optional().default([]),
            targets_overtime: z.array(z.string().uuid()).optional().default([]),
            shift: z.array(z.string().uuid()).optional().default([]),
          })
          .default({}),
        mode: z.enum(["add", "replace"]).default("add"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const kinds = Object.keys(KIND_TABLE) as Kind[];
    let inserted = 0;
    let cleared = 0;
    for (const kind of kinds) {
      const ids = data.assignments[kind] ?? [];
      if (data.mode === "replace" && ids.length === 0 && !Object.values(data.assignments).some((v) => v && v.length)) {
        // nothing to do for replace-with-empty across the board; treat as no-op
        continue;
      }
      if (data.mode === "add" && ids.length === 0) continue;
      const { table, col } = KIND_TABLE[kind];
      if (data.mode === "replace") {
        const { error: delErr } = await context.supabase
          .from(table)
          .delete()
          .in("employee_id", data.employee_ids);
        if (delErr) throw new Error(delErr.message);
        cleared += data.employee_ids.length;
      }
      if (ids.length === 0) continue;
      const rows: any[] = [];
      for (const emp of data.employee_ids) {
        for (const id of ids) rows.push({ employee_id: emp, [col]: id });
      }
      const { error: insErr } = await context.supabase
        .from(table)
        .upsert(rows as any, { onConflict: `employee_id,${col}`, ignoreDuplicates: true });
      if (insErr) throw new Error(insErr.message);
      inserted += rows.length;
    }
    return { ok: true, inserted, cleared };
  });