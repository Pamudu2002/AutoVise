import { isNum, stdev } from "./math";
import type { AnnualFinancials, RatioSet } from "./types";

/** Compound annual growth rate. Null when either end is not positive or no time has passed. */
export function cagr(first: number | null, last: number | null, years: number): number | null {
  if (!isNum(first) || !isNum(last) || first <= 0 || last <= 0 || years <= 0) return null;
  return (last / first) ** (1 / years) - 1;
}

/** CAGR between the first and last years that have a positive value. */
export function seriesCagr(points: { year: number; value: number | null }[]): number | null {
  const valid = points.filter((p) => isNum(p.value) && (p.value as number) > 0).sort((a, b) => a.year - b.year);
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  return cagr(first.value, last.value, last.year - first.year);
}

const ratio = (a: number | null | undefined, b: number | null | undefined): number | null =>
  isNum(a) && isNum(b) && b !== 0 ? a / b : null;

/** EPS for a year: the reported figure, or net income over shares when EPS is missing. */
export function epsOf(row: AnnualFinancials, sharesFallback?: number | null): number | null {
  if (isNum(row.eps)) return row.eps;
  const shares = isNum(row.sharesOutstanding) ? row.sharesOutstanding : sharesFallback;
  return ratio(row.netIncome, shares ?? null);
}

/** Fields we expect in the latest year; anything missing lowers confidence. */
export const KEY_FIELDS: (keyof AnnualFinancials)[] = [
  "revenue",
  "netIncome",
  "eps",
  "totalEquity",
  "totalAssets",
  "totalDebt",
  "operatingCashFlow",
  "dps",
];

/**
 * Standard ratios from annual history (oldest → newest) and the current price.
 * `latestBalance` lets a more recent interim balance sheet drive leverage ratios.
 */
export function computeRatios(
  history: AnnualFinancials[],
  price: number,
  opts: { sharesOutstanding?: number | null; latestBalance?: Partial<AnnualFinancials> | null } = {},
): RatioSet {
  const rows = [...history].sort((a, b) => a.year - b.year);
  const latest = rows[rows.length - 1];
  const shares = latest?.sharesOutstanding ?? opts.sharesOutstanding ?? null;

  const epsSeries = rows.map((r) => ({ year: r.year, value: epsOf(r, shares) }));
  const eps = latest ? epsOf(latest, shares) : null;
  const dps = latest?.dps ?? null;

  const bal = { ...latest, ...stripNulls(opts.latestBalance ?? {}) } as Partial<AnnualFinancials>;
  const bvps = ratio(latest?.totalEquity, shares);
  const fcf =
    isNum(latest?.operatingCashFlow) && isNum(latest?.capex)
      ? latest.operatingCashFlow - Math.abs(latest.capex)
      : null;
  const marketCap = isNum(shares) ? price * shares : null;

  // Year-on-year EPS growth, used for earnings volatility.
  const yoy: number[] = [];
  for (let i = 1; i < epsSeries.length; i++) {
    const a = epsSeries[i - 1].value;
    const b = epsSeries[i].value;
    if (isNum(a) && isNum(b) && a > 0) yoy.push(b / a - 1);
  }

  const missing = latest
    ? KEY_FIELDS.filter((f) => (f === "eps" ? !isNum(eps) : !isNum(latest[f] as number | null)))
    : [...KEY_FIELDS];

  return {
    latestYear: latest?.year ?? null,
    yearsOfHistory: rows.length,
    eps,
    dps,
    bvps,
    epsCagr: seriesCagr(epsSeries),
    revenueCagr: seriesCagr(rows.map((r) => ({ year: r.year, value: r.revenue }))),
    grossMargin: ratio(latest?.grossProfit, latest?.revenue),
    operatingMargin: ratio(latest?.operatingIncome, latest?.revenue),
    netMargin: ratio(latest?.netIncome, latest?.revenue),
    roe: ratio(latest?.netIncome, latest?.totalEquity),
    roa: ratio(latest?.netIncome, latest?.totalAssets),
    debtToEquity: ratio(bal.totalDebt, bal.totalEquity),
    currentRatio: ratio(bal.currentAssets, bal.currentLiabilities),
    fcf,
    fcfYield: ratio(fcf, marketCap),
    payoutRatio: isNum(dps) && isNum(eps) && eps > 0 ? dps / eps : null,
    pe: isNum(eps) && eps > 0 ? price / eps : null,
    pb: isNum(bvps) && bvps > 0 ? price / bvps : null,
    dividendYield: isNum(dps) && price > 0 ? dps / price : null,
    epsVolatility: stdev(yoy),
    completeness: {
      score: latest ? (KEY_FIELDS.length - missing.length) / KEY_FIELDS.length : 0,
      missing: missing as string[],
    },
  };
}

function stripNulls<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}
