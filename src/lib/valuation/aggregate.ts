import { isNum } from "./math";
import type { AnnualFinancials } from "./types";

/** A financial_metrics row as stored: statement figures in reported units plus a multiplier. */
export interface MetricRow {
  fiscalYear: number;
  period: string;
  periodEnd?: string | null;
  unitMultiplier: number;
  reportType?: string | null;
  /** When the source version was created; later versions win ties. */
  createdAt?: Date | string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  dps: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  totalDebt: number | null;
  cash: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  sharesOutstanding: number | null;
}

const SCALED: (keyof AnnualFinancials)[] = [
  "revenue",
  "grossProfit",
  "operatingIncome",
  "netIncome",
  "totalAssets",
  "totalLiabilities",
  "totalEquity",
  "currentAssets",
  "currentLiabilities",
  "totalDebt",
  "cash",
  "operatingCashFlow",
  "capex",
];

/** Scale statement figures by unit_multiplier; per-share figures and share counts stay as they are. */
export function normalise(row: MetricRow): AnnualFinancials {
  const m = isNum(row.unitMultiplier) && row.unitMultiplier > 0 ? row.unitMultiplier : 1;
  const out: AnnualFinancials = {
    year: row.fiscalYear,
    periodEnd: row.periodEnd ?? null,
    revenue: null,
    grossProfit: null,
    operatingIncome: null,
    netIncome: null,
    eps: row.eps,
    dps: row.dps,
    totalAssets: null,
    totalLiabilities: null,
    totalEquity: null,
    currentAssets: null,
    currentLiabilities: null,
    totalDebt: null,
    cash: null,
    operatingCashFlow: null,
    capex: null,
    sharesOutstanding: row.sharesOutstanding,
  };
  for (const k of SCALED) {
    const v = row[k as keyof MetricRow] as number | null;
    (out as unknown as Record<string, number | null>)[k] = isNum(v) ? v * m : null;
  }
  return out;
}

const PERIOD_ORDER: Record<string, number> = { Q1: 1, H1: 2, Q2: 2, Q3: 3, "9M": 3, Q4: 4, FY: 5 };
const rank = (p: string) => PERIOD_ORDER[p.toUpperCase()] ?? 0;
const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

/**
 * Builds the annual history from the current versions' metrics. Full-year rows ("FY") make the
 * history; when two reports carry the same year (an annual report and next year's comparatives),
 * the newer report wins and missing fields are filled from the older one.
 * The most recent balance sheet of any period (e.g. a Q2 interim) is returned separately.
 */
export function buildHistory(rows: MetricRow[]): {
  history: AnnualFinancials[];
  latestBalance: Partial<AnnualFinancials> | null;
  latestPeriodEnd: string | null;
} {
  const byYear = new Map<number, MetricRow[]>();
  for (const r of rows) {
    if (r.period.toUpperCase() !== "FY") continue;
    const list = byYear.get(r.fiscalYear) ?? [];
    list.push(r);
    byYear.set(r.fiscalYear, list);
  }
  const history: AnnualFinancials[] = [];
  for (const [, list] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...list].sort((a, b) => time(b.createdAt) - time(a.createdAt));
    const merged = normalise(sorted[0]);
    for (const older of sorted.slice(1)) {
      const n = normalise(older);
      for (const k of Object.keys(merged) as (keyof AnnualFinancials)[]) {
        if (merged[k] === null && n[k] !== null) (merged as unknown as Record<string, unknown>)[k] = n[k];
      }
    }
    history.push(merged);
  }

  const withBalance = rows
    .filter((r) => isNum(r.totalEquity))
    .sort((a, b) => b.fiscalYear - a.fiscalYear || rank(b.period) - rank(a.period) || time(b.createdAt) - time(a.createdAt));
  const lb = withBalance[0] ? normalise(withBalance[0]) : null;
  const latestBalance = lb
    ? {
        totalDebt: lb.totalDebt,
        totalEquity: lb.totalEquity,
        currentAssets: lb.currentAssets,
        currentLiabilities: lb.currentLiabilities,
        cash: lb.cash,
      }
    : null;

  const ends = rows.map((r) => r.periodEnd).filter((d): d is string => !!d).sort();
  const latestPeriodEnd =
    ends[ends.length - 1] ??
    (history.length ? `${history[history.length - 1].year}-12-31` : null);

  return { history, latestBalance, latestPeriodEnd };
}
