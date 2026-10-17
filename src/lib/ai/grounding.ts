/**
 * Number grounding for generated text: every figure the model writes must come from the inputs it
 * was given. Used by the pitch schema to reject invented numbers.
 */

export interface FoundNumber {
  raw: string;
  value: number;
  decimals: number;
}

// 1,234.56 | 12.5 | −8.0 | -3 ; optional trailing %, ×, x, bn, mn, m
const NUMBER_RE = /(?<![\w.])([−-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![\w.]*\d)/g;

export function extractNumbers(text: string): FoundNumber[] {
  const out: FoundNumber[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const sign = m[1] ? -1 : 1;
    const int = m[2].replace(/,/g, "");
    const frac = m[3] ?? "";
    const value = sign * Number(frac ? `${int}.${frac}` : int);
    if (Number.isFinite(value)) out.push({ raw: m[0], value, decimals: frac.length });
  }
  return out;
}

/** Years and small counts ("three risks", "2 quarters") are always allowed. */
function isExempt(n: FoundNumber): boolean {
  const v = Math.abs(n.value);
  if (n.decimals === 0 && v >= 1990 && v <= 2100) return true;
  if (n.decimals === 0 && v <= 12) return true;
  return false;
}

/** Every reasonable way an input number may be written: as is, as a percent, or scaled to thousands/millions/billions. */
export function numberVariants(values: number[]): number[] {
  const out = new Set<number>();
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const a = Math.abs(v);
    out.add(a);
    if (a <= 5) out.add(a * 100); // fractions → percent
    if (a >= 1_000) out.add(a / 1_000);
    if (a >= 1_000_000) out.add(a / 1_000_000);
    if (a >= 1_000_000_000) out.add(a / 1_000_000_000);
  }
  return [...out];
}

/** True when the number, at the precision it was written, matches one of the allowed values. */
export function isAllowed(n: FoundNumber, allowed: number[]): boolean {
  if (isExempt(n)) return true;
  const v = Math.abs(n.value);
  const tol = 0.5 * 10 ** -n.decimals + 1e-9;
  return allowed.some((a) => Math.abs(a - v) <= tol || (a > 0 && Math.abs(a - v) / a < 0.0005));
}

export function ungroundedNumbers(text: string, allowed: number[]): string[] {
  return extractNumbers(text)
    .filter((n) => !isAllowed(n, allowed))
    .map((n) => n.raw);
}

/** Collect every number found anywhere in a JSON-like value (and in strings inside it). */
export function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  else if (typeof value === "string") for (const n of extractNumbers(value)) out.push(n.value);
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectNumbers(v, out));
  return out;
}
