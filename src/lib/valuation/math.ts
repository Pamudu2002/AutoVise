export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Population standard deviation. */
export function stdev(values: number[]): number | null {
  const m = mean(values);
  if (m === null || values.length < 2) return null;
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length);
}

/** Round to a number of decimals without floating-point surprises like 1.005 → 1. */
export function round(v: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((v + Number.EPSILON) * f) / f;
}
