/** Format an ISO date (yyyy-mm-dd) as dd-mm-yyyy. Returns "—" when empty. */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  const iso = String(dateString).slice(0, 10);
  const parts = iso.split("-");
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return String(dateString);
}
