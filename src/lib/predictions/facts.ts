import { fmtMonthYear } from "@/lib/format";
import { round } from "@/lib/valuation/math";
import { toHundred } from "@/lib/valuation/qualitative";
import { FACTOR_LABELS, type AnnualFinancials, type FactorScore, type ValuationSettings } from "@/lib/valuation/types";
import type { ValuationResult } from "@/lib/valuation";

const p1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : round(v * 100, 1));
const d2 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : round(v, 2));
const d1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : round(v, 1));

/**
 * The computed figures, rounded the way they are displayed. This is the only numeric input the
 * pitch writer (Gemini or the template) receives, so every number in a pitch traces back to it.
 */
export function pitchFacts(input: {
  name: string;
  ticker: string;
  currency: string;
  result: ValuationResult;
  factorScores: FactorScore[];
  history: AnnualFinancials[];
  scenarioShift: ValuationSettings["scenario"];
}) {
  const { result: r, currency } = input;
  const a = r.assumptions;
  const last = a.rows[a.rows.length - 1];
  const price = a.price;
  return {
    company: input.name,
    ticker: input.ticker,
    currency,
    sector: a.sector.name,
    price: d2(price)!,
    priceDate: a.priceDate,
    horizon: fmtMonthYear(a.horizonDate),
    target: {
      bear: d2(r.scenarios.bear.y3)!,
      base: d2(r.scenarios.base.y3)!,
      bull: d2(r.scenarios.bull.y3)!,
      baseYear1: d2(r.scenarios.base.y1)!,
      baseYear2: d2(r.scenarios.base.y2)!,
    },
    upsidePct: {
      base: p1(r.upsidePct)!,
      bear: p1(r.scenarios.bear.y3 / price - 1)!,
      bull: p1(r.scenarios.bull.y3 / price - 1)!,
    },
    eps: { base: d2(a.eps0)!, baseYear: a.epsYear, year3: d2(last.eps)! },
    growthPct: {
      blended: p1(a.growth.blended)!,
      historical: p1(a.growth.historical),
      sustainable: p1(a.growth.sustainable),
      sector: p1(a.growth.sector)!,
      scenarioShiftPoints: p1(input.scenarioShift.growthShift)!,
    },
    pe: {
      now: d1(a.pe0)!,
      exit: d1(a.exitPe.final)!,
      exitBeforeQualitative: d1(a.exitPe.quant)!,
      sector: d1(a.sector.pe)!,
      bullExit: d1(a.bullLevers.exitPe)!,
      bearExit: d1(a.bearLevers.exitPe)!,
    },
    qualitative: { compositeScore: toHundred(a.qualitative.composite), priceEffectPct: p1(a.qualitative.tiltPct)! },
    methods: a.methods
      ? {
          peValue: d2(a.methods.pe)!,
          dcfValue: a.methods.weights.dcf > 0 ? d2(a.methods.dcf) : null,
          dividendValue: a.methods.weights.ddm > 0 ? d2(a.methods.ddm) : null,
          weightsPct: { pe: Math.round(a.methods.weights.pe * 100), dcf: Math.round(a.methods.weights.dcf * 100), dividend: Math.round(a.methods.weights.ddm * 100) },
          cashConversionPct: a.dcf ? p1(a.dcf.fcfConversion) : null,
          costOfEquityPct: p1(a.dcf?.costOfEquity ?? a.ddm?.costOfEquity ?? null),
          terminalGrowthPct: a.dcf ? p1(a.dcf.terminalGrowth) : null,
        }
      : null,
    waterfall: r.waterfall.map((w) => ({ step: w.label, value: d2(w.value)! })),
    ratios: {
      roePct: p1(r.ratios.roe),
      netMarginPct: p1(r.ratios.netMargin),
      debtToEquity: d2(r.ratios.debtToEquity),
      dividendYieldPct: p1(r.ratios.dividendYield),
      payoutRatioPct: p1(r.ratios.payoutRatio),
      revenueGrowthPct: p1(r.ratios.revenueCagr),
      epsGrowthPct: p1(r.ratios.epsCagr),
      sectorRoePct: p1(a.sector.roe),
    },
    confidence: r.confidence,
    autoviseScore: r.autoviseScore,
    factors: input.factorScores.map((f) => ({ factor: FACTOR_LABELS[f.key], score: toHundred(f.score), justification: f.justification })),
    history: input.history.slice(-4).map((h) => ({
      year: h.year,
      revenueMillions: h.revenue === null ? null : Math.round(h.revenue / 1e6),
      netIncomeMillions: h.netIncome === null ? null : Math.round(h.netIncome / 1e6),
      eps: d2(h.eps),
    })),
  };
}

export type PitchFacts = ReturnType<typeof pitchFacts>;
