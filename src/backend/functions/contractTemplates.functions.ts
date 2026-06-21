import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

const TemplateInput = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  body: z.string().default(""),
  active: z.boolean().optional(),
});

export const listContractTemplates = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contract_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => TemplateInput.parse(i))
  .handler(async ({ data, context }) => {
    const payload: {
      id?: string;
      name: string;
      description: string | null;
      body: string;
      active: boolean;
      created_by?: string;
    } = {
      name: data.name,
      description: data.description ?? null,
      body: data.body ?? "",
      active: data.active ?? true,
    };
    if (data.id) payload.id = data.id;
    else payload.created_by = context.userId;
    const { data: row, error } = await context.supabase
      .from("contract_templates")
      .upsert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contract_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });