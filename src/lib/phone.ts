// Egyptian mobile: +20 followed by 10 digits starting with 1
// Valid prefixes: 010 (Vodafone), 011 (Etisalat), 012 (Orange), 015 (WE)
export function formatEgPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("0020")) local = local.slice(4);
  else if (local.startsWith("20")) local = local.slice(2);
  if (local.startsWith("0")) local = local.slice(1);
  local = local.slice(0, 10);
  if (!local) return "";
  const a = local.slice(0, 3);
  const b = local.slice(3, 6);
  const c = local.slice(6, 10);
  return `+20 ${a}${b ? " " + b : ""}${c ? " " + c : ""}`.trim();
}

export function isValidEgPhone(input: string): boolean {
  const digits = input.replace(/\D/g, "").replace(/^0020|^20/, "").replace(/^0/, "");
  return /^1[0125]\d{8}$/.test(digits);
}

export function normalizeEgPhone(input: string): string {
  return isValidEgPhone(input) ? formatEgPhone(input) : input.trim();
}
