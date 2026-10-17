import { clamp, isNum } from "./math";
import type { ProjectionModel, ProjectionRow, ValuationSettings } from "./types";

export interface GrowthComponents {
  historical: number | null;
  sustainable: number | null;
  sector: number;
}

/**
 * Starting EPS growth: a weighted blend of the company's own EPS CAGR, sustainable growth
 * (ROE × retention) and the sector benchmark. Missing components drop out and the remaining
 * weights are renormalised. The result is clamped to the settings' growth limits.
 */
export function blendGrowth(
  c: GrowthComponents,
  weights: ValuationSettings["growthWeights"],
  limits: { minGrowth: number; maxGrowth: number },
): { growth: number; weights: { historical: number; sustainable: number; sector: number } } {
  const parts: [keyof GrowthComponents, number | null, number][] = [
    ["historical", c.historical, weights.historical],
    ["sustainable", c.sustainable, weights.sustainable],
    ["sector", c.sector, weights.sector],
  ];
  const used = parts.filter(([, v, w]) => isNum(v) && w > 0);
  const total = used.reduce((a, [, , w]) => a + w, 0);
  const out = { historical: 0, sustainable: 0, sector: 0 };
  if (total <= 0) return { growth: clamp(c.sector, limits.minGrowth, limits.maxGrowth), weights: { ...out, sector: 1 } };
  let g = 0;
  for (const [k, v, w] of used) {
    out[k] = w / total;
    g += (v as number) * (w / total);
  }
  return { growth: clamp(g, limits.minGrowth, limits.maxGrowth), weights: out };
}

/** Sustainable growth = ROE × (1 − payout ratio). Null without a positive ROE. */
export function sustainableGrowth(roe: number | null, payoutRatio: number | null): number | null {
  if (!isNum(roe) || roe <= 0) return null;
  const retention = isNum(payoutRatio) ? clamp(1 - payoutRatio, 0, 1) : 1;
  return roe * retention;
}

/**
 * Year-by-year growth that mean-reverts toward the sector rate:
 * g_n = sector + (g0 − sector) × (1 − reversion)^(n−1).
 */
export function growthPath(
  g0: number,
  sectorGrowth: number,
  reversion: number,
  years: number,
  limits: { minGrowth: number; maxGrowth: number },
): number[] {
  const out: number[] = [];
  for (let n = 1; n <= years; n++) {
    const g = sectorGrowth + (g0 - sectorGrowth) * (1 - reversion) ** (n - 1);
    out.push(clamp(g, limits.minGrowth, limits.maxGrowth));
  }
  return out;
}

/** Exit P/E before the qualitative overlay: today's P/E moved toward the sector P/E. */
export function quantExitPe(
  pe0: number,
  sectorPe: number,
  convergence: number,
  limits: { minExitPe: number; maxExitPe: number },
): number {
  return clamp(pe0 + (sectorPe - pe0) * clamp(convergence, 0, 1), limits.minExitPe, limits.maxExitPe);
}

/** The multiple moves in a straight line from today's P/E to the exit P/E. */
export function pePath(pe0: number, exitPe: number, years: number): number[] {
  return Array.from({ length: years }, (_, i) => pe0 + ((exitPe - pe0) * (i + 1)) / years);
}

/** EPS × P/E for each year of the horizon. */
export function projectPath(eps0: number, growth: number[], pes: number[]): ProjectionRow[] {
  let eps = eps0;
  return growth.map((g, i) => {
    eps = eps * (1 + g);
    return { year: i + 1, eps, pe: pes[i], growth: g, price: eps * pes[i] };
  });
}

/**
 * Dividend-discount value at the end of year n (Gordon growth on the next year's dividend).
 * Dividends follow EPS at a constant payout ratio.
 */
export function ddmValueAt(
  rows: ProjectionRow[],
  n: number,
  ddm: NonNullable<ProjectionModel["ddm"]>,
): number | null {
  const spread = ddm.costOfEquity - ddm.terminalGrowth;
  if (spread <= 0.005) return null;
  const row = rows[n - 1];
  if (!row) return null;
  const nextDividend = row.eps * ddm.payoutRatio * (1 + ddm.terminalGrowth);
  if (nextDividend <= 0) return null;
  return nextDividend / spread;
}
