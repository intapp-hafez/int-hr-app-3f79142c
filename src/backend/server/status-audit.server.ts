/**
 * Records employee status changes in employee_status_audit.
 * Never throws: a failed audit write must not break the status update,
 * but it is always logged so silent RLS/permission failures are visible.
 */
export type StatusAuditEntry = {
  profile_id: string;
  previous_status: string | null;
  new_status: string;
  inactive_reason?: string | null;
  source: string;
  changed_by: string | null;
};

export async function logStatusChanges(
  supabase: any,
  entries: StatusAuditEntry[],
): Promise<{ inserted: number; error: string | null }> {
  const rows = entries
    .filter((e) => (e.previous_status ?? null) !== e.new_status)
    .map((e) => ({
      profile_id: e.profile_id,
      previous_status: e.previous_status ?? null,
      new_status: e.new_status,
      inactive_reason: e.new_status === "Inactive" ? (e.inactive_reason ?? null) : null,
      source: e.source,
      changed_by: e.changed_by,
    }));
  if (rows.length === 0) return { inserted: 0, error: null };
  try {
    const { error } = await supabase.from("employee_status_audit").insert(rows);
    if (error) {
      console.error("[status-audit] insert failed:", error.message);
      return { inserted: 0, error: error.message };
    }
    return { inserted: rows.length, error: null };
  } catch (err: any) {
    console.error("[status-audit] insert threw:", err?.message ?? err);
    return { inserted: 0, error: String(err?.message ?? err) };
  }
}
