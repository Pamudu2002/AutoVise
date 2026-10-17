import { autoviseScore, confidenceScore } from "./confidence";
import { clamp, isNum } from "./math";
import { blendGrowth, quantExitPe, sustainableGrowth } from "./projection";
import { compositeScore } from "./qualitative";
import { computeRatios } from "./ratios";
import { buildScenarios, type ScenarioRun } from "./scenarios";
import type {
  AnnualFinancials,
  Assumptions,
  FactorScore,
  ProjectionModel,
  RatioSet,
  ScenarioSet,
  SectorBenchmarks,
  ValuationSettings,
  WaterfallStep,
} from "./types";

export * from "./types";
export { DEFAULT_VALUATION_SETTINGS } from "./defaults";
export { runScenario, buildScenarios, pricesOf } from "./scenarios";
export { computeRatios } from "./ratios";
export { buildHistory, type MetricRow } from "./aggregate";
export { heuristicFactorScores, compositeScore, toHundred } from "./qualitative";
export { confidenceLabel } from "./confidence";

export interface ValuationInput {
  price: number;
  priceDate: string | null;
  history: AnnualFinancials[];
  latestBalance?: Partial<AnnualFinancials> | null;
  latestPeriodEnd: string | null;
  sharesOutstanding?: number | null;
  sector: SectorBenchmarks;
  factorScores: FactorScore[];
  asOf: Date;
  settings: ValuationSettings;
}

export interface ValuationResult {
  scenarios: ScenarioSet;
  upsidePct: number;
  confidence: number;
  autoviseScore: number;
  assumptions: Assumptions;
  waterfall: WaterfallStep[];
  ratios: RatioSet;
}

export type ValuationOutcome = { ok: true; result: ValuationResult } | { ok: false; reason: string };

/**
 * Values one company. Pure and deterministic: the same input always gives the same output.
 * The LLM never touches these numbers; it only supplies the factor scores (capped) and the words.
 */
export function valueCompany(input: ValuationInput): ValuationOutcome {
  const s = input.settings;
  if (!isNum(input.price) || input.price <= 0) return { ok: false, reason: "No current share price." };
  if (input.history.length === 0) return { ok: false, reason: "No approved annual figures yet." };

  const ratios = computeRatios(input.history, input.price, {
    sharesOutstanding: input.sharesOutstanding,
    latestBalance: input.latestBalance,
  });
  const eps0 = ratios.eps;
  if (!isNum(eps0) || eps0 <= 0) {
    return { ok: false, reason: "Latest EPS is missing or not positive, so a P/E-based target cannot be set." };
  }
  const pe0 = input.price / eps0;
  const limits = { minGrowth: s.minGrowth, maxGrowth: s.maxGrowth };
  const notes: string[] = [];

  const historical = isNum(ratios.epsCagr) ? clamp(ratios.epsCagr, s.minGrowth, s.maxGrowth) : null;
  const sustainableRaw = sustainableGrowth(ratios.roe, ratios.payoutRatio);
  const sustainable = isNum(sustainableRaw) ? clamp(sustainableRaw, s.minGrowth, s.maxGrowth) : null;
  if (historical === null) notes.push("Not enough EPS history for a growth record; the blend leans on sustainable and sector growth.");
  if (sustainable === null) notes.push("Sustainable growth (ROE × retention) could not be computed.");
  if (isNum(ratios.epsCagr) && ratios.epsCagr !== historical) notes.push("Historical EPS growth was outside the allowed range and was clipped.");

  const blend = blendGrowth({ historical, sustainable, sector: input.sector.growth }, s.growthWeights, limits);
  const exitQuant = quantExitPe(pe0, input.sector.pe, s.peConvergence, s);
  const composite = compositeScore(input.factorScores, s.factorWeights);

  const payoutRatio = isNum(ratios.payoutRatio) ? clamp(ratios.payoutRatio, 0, 1) : null;
  const ddm =
    s.ddm.weight > 0 && payoutRatio !== null && payoutRatio > 0
      ? {
          weight: s.ddm.weight,
          costOfEquity: s.ddm.costOfEquity,
          terminalGrowth: Math.min(input.sector.growth, s.ddm.terminalGrowthCap),
          payoutRatio,
        }
      : null;
  if (!ddm) notes.push("No dividend, so the dividend-discount cross-check was skipped.");

  const model: ProjectionModel = {
    price: input.price,
    eps0,
    pe0,
    years: s.horizonYears,
    sectorGrowth: input.sector.growth,
    meanReversion: s.meanReversion,
    minGrowth: s.minGrowth,
    maxGrowth: s.maxGrowth,
    minExitPe: s.minExitPe,
    maxExitPe: s.maxExitPe,
    qualGrowthCap: s.qualGrowthCap,
    qualMultipleCap: s.qualMultipleCap,
    tiltCap: s.tiltCap,
    ddm,
  };
  const baseLevers = { growth: blend.growth, exitPe: exitQuant, tilt: composite };
  const { set: scenarios, runs, levers } = buildScenarios(model, baseLevers, s.scenario);
  const base = runs.base;

  const upsidePct = scenarios.base.y3 / input.price - 1;
  const conf = confidenceScore({
    ratios,
    factorScores: input.factorScores,
    scenarios,
    latestPeriodEnd: input.latestPeriodEnd,
    asOf: input.asOf,
  });
  const score = autoviseScore({ upside: upsidePct, composite, confidence: conf.score }, s.scoreWeights);

  const horizon = new Date(input.asOf);
  horizon.setUTCFullYear(horizon.getUTCFullYear() + s.horizonYears);
  const last = base.rows.length - 1;
  const shifts = { growthShift: composite * s.qualGrowthCap, multipleShift: composite * s.qualMultipleCap };

  const assumptions: Assumptions = {
    price: input.price,
    priceDate: input.priceDate,
    eps0,
    epsYear: ratios.latestYear,
    pe0,
    sector: input.sector,
    growth: {
      blended: blend.growth,
      historical,
      sustainable,
      sector: input.sector.growth,
      weights: blend.weights,
      path: base.growth,
    },
    exitPe: { quant: exitQuant, final: base.exitPe },
    qualitative: { composite, ...shifts, tiltPct: base.tiltPct },
    ddm,
    horizonYears: s.horizonYears,
    horizonDate: horizon.toISOString().slice(0, 10),
    rows: base.rows,
    ratios,
    confidenceBreakdown: conf.breakdown,
    scoreBreakdown: score.breakdown,
    model,
    baseLevers,
    bearLevers: levers.bear,
    bullLevers: levers.bull,
    notes,
  };

  return {
    ok: true,
    result: {
      scenarios,
      upsidePct,
      confidence: conf.score,
      autoviseScore: score.score,
      assumptions,
      waterfall: buildWaterfall(input.price, pe0, base, last),
      ratios,
    },
  };
}

/** Current price → earnings growth → multiple change → (dividend check) → qualitative → target. */
export function buildWaterfall(price: number, pe0: number, run: ScenarioRun, last = run.rows.length - 1): WaterfallStep[] {
  const eps3 = run.quantRows[last].eps;
  const atTodaysPe = eps3 * pe0;
  const atExitPe = run.quantRows[last].price;
  const quant = run.quantPrices[last];
  const target = run.rows[last].price;
  const steps: WaterfallStep[] = [
    { key: "current", label: "Current price", value: price, start: 0, end: price },
    { key: "earnings", label: "Earnings growth", value: atTodaysPe - price, start: price, end: atTodaysPe },
    { key: "multiple", label: "Multiple change", value: atExitPe - atTodaysPe, start: atTodaysPe, end: atExitPe },
  ];
  if (Math.abs(quant - atExitPe) > 0.005) {
    steps.push({ key: "dividend", label: "Dividend cross-check", value: quant - atExitPe, start: atExitPe, end: quant });
  }
  steps.push(
    { key: "qualitative", label: "Qualitative adjustment", value: target - quant, start: quant, end: target },
    { key: "target", label: "3-yr target", value: target, start: 0, end: target },
  );
  return steps;
}
