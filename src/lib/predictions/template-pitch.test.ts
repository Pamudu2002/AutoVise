import { describe, expect, it } from "vitest";
import { collectNumbers, numberVariants } from "@/lib/ai/grounding";
import { makePitchSchema } from "@/lib/ai/schemas";
import { DEFAULT_VALUATION_SETTINGS } from "@/lib/valuation/defaults";
import { valueCompany } from "@/lib/valuation";
import { FACTOR_KEYS, type AnnualFinancials } from "@/lib/valuation/types";
import { pitchFacts } from "./facts";
import { templatePitch } from "./template-pitch";

const year = (y: number, eps: number): AnnualFinancials => ({
  year: y,
  revenue: eps * 100e6,
  grossProfit: null,
  operatingIncome: null,
  netIncome: eps * 10e6,
  eps,
  dps: eps * 0.4,
  totalAssets: 2e9,
  totalLiabilities: 1e9,
  totalEquity: 1e9,
  currentAssets: null,
  currentLiabilities: null,
  totalDebt: 4e8,
  cash: null,
  operatingCashFlow: 1.3e8,
  capex: 5e7,
  sharesOutstanding: 10e6,
});

describe("templatePitch", () => {
  for (const [label, tilt, price] of [
    ["upside", 0.3, 120],
    ["downside", -0.5, 260],
  ] as const) {
    it(`only uses grounded numbers (${label})`, () => {
      const out = valueCompany({
        price,
        priceDate: "2026-10-16",
        history: [year(2022, 8), year(2023, 9), year(2024, 9.6), year(2025, 10.4)],
        latestPeriodEnd: "2025-12-31",
        sector: { name: "Logistics", pe: 11.8, growth: 0.084, roe: 0.12 },
        factorScores: FACTOR_KEYS.map((key) => ({ key, score: tilt, justification: "test", evidence: [] })),
        asOf: new Date("2026-10-17"),
        settings: DEFAULT_VALUATION_SETTINGS,
      });
      if (!out.ok) throw new Error(out.reason);
      const facts = pitchFacts({ name: "Test Co", ticker: "TST", currency: "LKR", result: out.result, factorScores: [], history: [], scenarioShift: DEFAULT_VALUATION_SETTINGS.scenario });
      const insights = [
        { sourceId: "S1", category: "outlook", summary: "Volumes rose 14% to a record.", sentiment: 0.6, impact: "high" as const },
        { sourceId: "S2", category: "risk", summary: "Three customers make up 46% of volume.", sentiment: -0.6, impact: "high" as const },
        { sourceId: "S3", category: "strategy", summary: "New warehouse opened in May.", sentiment: 0.4, impact: "med" as const },
      ];
      const sourcesText = insights.map((i) => `${i.sourceId}: ${i.summary}`).join("\n");
      const pitch = templatePitch(facts, insights);
      const schema = makePitchSchema(numberVariants([...collectNumbers(facts), ...collectNumbers(sourcesText), 100]), ["S1", "S2", "S3"]);
      const res = schema.safeParse(pitch);
      expect(res.success, JSON.stringify(res.error?.issues)).toBe(true);
      expect(pitch.thesis.headline).toContain(`LKR ${facts.target.base.toFixed(2)}`);
    });
  }
});
