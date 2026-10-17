import { clamp, isNum, stdev } from "./math";
import type { ConfidenceBreakdown, FactorScore, RatioSet, ScenarioSet, ValuationSettings } from "./types";

export const CONFIDENCE_WEIGHTS: Record<keyof ConfidenceBreakdown, number> = {
  completeness: 0.25,
  history: 0.2,
  stability: 0.2,
  agreement: 0.1,
  recency: 0.1,
  spread: 0.15,
};

/** Months between a period end (YYYY-MM-DD) and a date. */
export function monthsBetween(from: string, to: Date): number {
  const d = new Date(from + "T00:00:00Z");
  return (to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

/**
 * Confidence (0–100) in the prediction itself: complete, long, stable, recent data and agreeing
 * factor scores raise it; a wide bear–bull range lowers it.
 */
export function confidenceScore(input: {
  ratios: RatioSet;
  factorScores: FactorScore[];
  scenarios: ScenarioSet;
  latestPeriodEnd: string | null;
  asOf: Date;
}): { score: number; breakdown: ConfidenceBreakdown } {
  const { ratios, factorScores, scenarios } = input;
  const completeness = clamp(ratios.completeness.score, 0, 1);
  const history = clamp(ratios.yearsOfHistory / 5, 0, 1);
  const stability = isNum(ratios.epsVolatility) ? clamp(1 - ratios.epsVolatility / 0.25, 0, 1) : 0.4;
  const sd = stdev(factorScores.map((f) => f.score));
  const agreement = sd === null ? 0.5 : clamp(1 - sd, 0, 1);
  const age = input.latestPeriodEnd ? monthsBetween(input.latestPeriodEnd, input.asOf) : null;
  const recency = age === null ? 0.3 : age <= 12 ? 1 : clamp(1 - (age - 12) / 18, 0, 1);
  const width = scenarios.base.y3 > 0 ? (scenarios.bull.y3 - scenarios.bear.y3) / scenarios.base.y3 : 1;
  const spread = clamp(1 - (width - 0.2) / 0.6, 0, 1);

  const breakdown = { completeness, history, stability, agreement, recency, spread };
  let total = 0;
  for (const k of Object.keys(CONFIDENCE_WEIGHTS) as (keyof ConfidenceBreakdown)[]) {
    total += CONFIDENCE_WEIGHTS[k] * breakdown[k];
  }
  return { score: Math.round(clamp(total, 0, 1) * 100), breakdown };
}

/** −30 % or worse scores 0, +60 % or better scores 100, linear in between. */
export function upsideToScore(upside: number): number {
  return clamp(((upside + 0.3) / 0.9) * 100, 0, 100);
}

/** The AutoVise Score: weighted blend of upside, qualitative quality and confidence (0–100). */
export function autoviseScore(
  input: { upside: number; composite: number; confidence: number },
  weights: ValuationSettings["scoreWeights"],
): { score: number; breakdown: { upside: number; quality: number; confidence: number } } {
  const parts = {
    upside: upsideToScore(input.upside),
    quality: ((clamp(input.composite, -1, 1) + 1) / 2) * 100,
    confidence: clamp(input.confidence, 0, 100),
  };
  const total = weights.upside + weights.quality + weights.confidence || 1;
  const score = (parts.upside * weights.upside + parts.quality * weights.quality + parts.confidence * weights.confidence) / total;
  return {
    score: Math.round(score),
    breakdown: { upside: Math.round(parts.upside), quality: Math.round(parts.quality), confidence: Math.round(parts.confidence) },
  };
}

export function confidenceLabel(c: number): "High" | "Med" | "Low" {
  return c >= 70 ? "High" : c >= 60 ? "Med" : "Low";
}
