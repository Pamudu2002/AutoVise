import type { ValuationSettings } from "./types";

export const DEFAULT_VALUATION_SETTINGS: ValuationSettings = {
  horizonYears: 3,
  growthWeights: { historical: 0.4, sustainable: 0.3, sector: 0.3 },
  meanReversion: 0.25,
  peConvergence: 0.5,
  minGrowth: -0.1,
  maxGrowth: 0.3,
  minExitPe: 4,
  maxExitPe: 25,
  qualGrowthCap: 0.03,
  qualMultipleCap: 0.15,
  tiltCap: 0.1,
  scenario: { growthShift: 0.04, peShift: 0.15 },
  ddm: { weight: 0.1, costOfEquity: 0.14, terminalGrowthCap: 0.06 },
  factorWeights: {
    management: 1,
    growth_outlook: 1,
    competitive_position: 1,
    risk_profile: 1,
    governance: 1,
    sentiment: 1,
  },
  scoreWeights: { upside: 40, quality: 40, confidence: 20 },
};
