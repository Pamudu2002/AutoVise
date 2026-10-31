/**
 * Shared types for the valuation engine. Everything here is plain data so it can be stored as
 * jsonb on a prediction and sent to the browser for the what-if simulator.
 * Rates are fractions (0.11 = 11 %), money is in the company's currency.
 */

export const FACTOR_KEYS = [
  "management",
  "growth_outlook",
  "competitive_position",
  "risk_profile",
  "governance",
  "sentiment",
] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export const FACTOR_LABELS: Record<FactorKey, string> = {
  management: "Management",
  growth_outlook: "Growth outlook",
  competitive_position: "Competitive position",
  risk_profile: "Risk profile",
  governance: "Governance",
  sentiment: "Sentiment",
};

export interface FactorEvidence {
  quote: string;
  page?: number | null;
  reportVersionId?: string | null;
  label?: string | null;
}

export interface FactorScore {
  key: FactorKey;
  /** −1..+1; for risk_profile a higher score means lower risk. */
  score: number;
  justification: string;
  evidence: FactorEvidence[];
}

/** One fiscal year of figures, already scaled to units of currency (per-share figures as reported). */
export interface AnnualFinancials {
  year: number;
  periodEnd?: string | null;
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

export interface SectorBenchmarks {
  name: string;
  pe: number;
  growth: number;
  roe: number;
  /** False for sectors where free cash flow is not meaningful (e.g. banks). Defaults to true. */
  dcf?: boolean;
}

export interface ValuationSettings {
  horizonYears: number;
  /** Weights for the EPS growth blend; normalised over the components that exist. */
  growthWeights: { historical: number; sustainable: number; sector: number };
  /** Share of the gap to the sector growth rate closed each year (0..1). */
  meanReversion: number;
  /** How far the exit P/E moves from today's P/E toward the sector P/E over the horizon (0..1). */
  peConvergence: number;
  minGrowth: number;
  maxGrowth: number;
  minExitPe: number;
  maxExitPe: number;
  /** Largest growth shift the qualitative composite can make, in rate points (0.03 = 3 pp). */
  qualGrowthCap: number;
  /** Largest exit-multiple shift the qualitative composite can make (0.15 = ±15 %). */
  qualMultipleCap: number;
  /** Largest combined price effect of the qualitative overlay (0.10 = ±10 %). */
  tiltCap: number;
  scenario: { growthShift: number; peShift: number };
  /** Required return on equity, used to discount dividends and free cash flow. */
  costOfEquity: number;
  /** Upper limit for the long-run growth used in terminal values. */
  terminalGrowthCap: number;
  /** Discounted cash flow method: blend weight, and years over which growth fades to the terminal rate. */
  dcf: { weight: number; fadeYears: number };
  /** Dividend-discount cross-check blend weight. */
  ddm: { weight: number };
  factorWeights: Record<FactorKey, number>;
  /** AutoVise Score weights in percent; must add up to 100. */
  scoreWeights: { upside: number; quality: number; confidence: number };
}

export interface RatioSet {
  latestYear: number | null;
  yearsOfHistory: number;
  eps: number | null;
  dps: number | null;
  bvps: number | null;
  epsCagr: number | null;
  revenueCagr: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  roa: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  fcf: number | null;
  fcfYield: number | null;
  payoutRatio: number | null;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
  epsVolatility: number | null;
  completeness: { score: number; missing: string[] };
}

/** Everything the browser needs to rerun the projection with different levers. */
export interface ProjectionModel {
  price: number;
  eps0: number;
  pe0: number;
  years: number;
  sectorGrowth: number;
  meanReversion: number;
  minGrowth: number;
  maxGrowth: number;
  minExitPe: number;
  maxExitPe: number;
  qualGrowthCap: number;
  qualMultipleCap: number;
  tiltCap: number;
  ddm: null | { weight: number; costOfEquity: number; terminalGrowth: number; payoutRatio: number };
  /** Absent on predictions made before the DCF method existed. */
  dcf?: null | { weight: number; costOfEquity: number; terminalGrowth: number; fcfConversion: number; fadeYears: number };
}

export interface MethodWeights {
  pe: number;
  dcf: number;
  ddm: number;
}

/** The three levers of a scenario: starting EPS growth, exit P/E (before the overlay) and the qualitative composite (−1..+1). */
export interface Levers {
  growth: number;
  exitPe: number;
  tilt: number;
}

export interface ProjectionRow {
  year: number;
  eps: number;
  pe: number;
  growth: number;
  price: number;
}

export interface ScenarioPrices {
  y1: number;
  y2: number;
  y3: number;
}

export interface ScenarioSet {
  bear: ScenarioPrices;
  base: ScenarioPrices;
  bull: ScenarioPrices;
}

export interface WaterfallStep {
  key: "current" | "earnings" | "multiple" | "dcf" | "dividend" | "qualitative" | "target";
  label: string;
  /** For totals the absolute value; for steps the signed change. */
  value: number;
  start: number;
  end: number;
}

export interface ConfidenceBreakdown {
  completeness: number;
  history: number;
  stability: number;
  agreement: number;
  recency: number;
  spread: number;
}

export interface Assumptions {
  price: number;
  priceDate: string | null;
  eps0: number;
  epsYear: number | null;
  pe0: number;
  sector: SectorBenchmarks;
  growth: {
    blended: number;
    historical: number | null;
    sustainable: number | null;
    sector: number;
    weights: { historical: number; sustainable: number; sector: number };
    path: number[];
  };
  exitPe: { quant: number; final: number };
  qualitative: { composite: number; growthShift: number; multipleShift: number; tiltPct: number };
  ddm: ProjectionModel["ddm"];
  dcf?: ProjectionModel["dcf"];
  /** Year-3 value from each method (before the qualitative overlay) and the blend weights used. */
  methods?: { pe: number; dcf: number | null; ddm: number | null; weights: MethodWeights };
  horizonYears: number;
  horizonDate: string;
  rows: ProjectionRow[];
  ratios: RatioSet;
  confidenceBreakdown: ConfidenceBreakdown;
  scoreBreakdown: { upside: number; quality: number; confidence: number };
  model: ProjectionModel;
  baseLevers: Levers;
  bearLevers: Levers;
  bullLevers: Levers;
  notes: string[];
}

export interface OverrideNote {
  by: string | null;
  name: string;
  at: string;
  text: string;
}

export interface BasedOnReport {
  reportId: string;
  versionId: string;
  title: string;
  versionNo: number;
  periodEnd: string | null;
}
