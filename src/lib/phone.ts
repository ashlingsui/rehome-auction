// Normalize a phone number into a compact form we can use as a unique handle.
// Strips everything except digits and a leading +.
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function isValidPhone(input: string): boolean {
  const n = normalizePhone(input);
  const digitsOnly = n.replace(/\D/g, "");
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

// Build a synthetic email for Supabase auth from a phone number.
export function phoneToSyntheticEmail(phone: string): string {
  const n = normalizePhone(phone).replace(/\D/g, "");
  return `user${n}@movingsale.local`;
}

export function formatPhoneDisplay(input: string): string {
  const n = normalizePhone(input).replace(/\D/g, "");
  if (n.length === 10) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  if (n.length === 11 && n.startsWith("1"))
    return `+1 (${n.slice(1, 4)}) ${n.slice(4, 7)}-${n.slice(7)}`;
  return input;
}
