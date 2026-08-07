/** Normalizes a Swiss phone number (various local formats) to E.164 (+41...). */
export function toE164Swiss(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0041")) return `+${digits.slice(2)}`;
  if (digits.startsWith("41")) return `+${digits}`;
  if (digits.startsWith("0")) return `+41${digits.slice(1)}`;
  return `+41${digits}`;
}
