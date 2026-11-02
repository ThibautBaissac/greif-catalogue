/** Th number: digits, optionally followed by one letter (`45`, `35b`). Shared by the schemas and the Keystatic field. */
export const TH_PATTERN = /^(\d+)([a-z]?)$/;

/** `35b` -> 352 ; `7` -> 70 ; toute autre forme -> Infinity. */
export function thKey(th: string): number {
  const m = TH_PATTERN.exec(th);
  if (!m) return Infinity;
  return Number(m[1]) * 10 + (m[2] ? m[2].charCodeAt(0) - 96 : 0);
}

export function compareTh(a: string, b: string): number {
  const ka = thKey(a);
  const kb = thKey(b);
  if (ka === kb) return a < b ? -1 : a > b ? 1 : 0;
  return ka < kb ? -1 : 1;
}
