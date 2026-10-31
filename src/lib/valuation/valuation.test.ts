import { describe, expect, it } from "vitest";
import { buildHistory, type MetricRow } from "./aggregate";
import { autoviseScore, confidenceScore, upsideToScore } from "./confidence";
import { DEFAULT_VALUATION_SETTINGS } from "./defaults";
import { buildWaterfall, valueCompany, type ValuationInput } from "./index";
import { blendGrowth, dcfValueAt, fadeGrowth, fcfConversion, growthPath, pePath, projectPath, quantExitPe, sustainableGrowth } from "./projection";
import { compositeScore, heuristicFactorScores, overlayShifts, toHundred } from "./qualitative";
import { cagr, computeRatios, epsOf, seriesCagr } from "./ratios";
import { buildScenarios, runScenario } from "./scenarios";
import { FACTOR_KEYS, type AnnualFinancials, type FactorScore, type ProjectionModel } from "./types";

const year = (y: number, over: Partial<AnnualFinancials> = {}): AnnualFinancials => ({
  year: y,
  revenue: 1000,
  grossProfit: 400,
  operatingIncome: 200,
  netIncome: 100,
  eps: 10,
  dps: 4,
  totalAssets: 2000,
  totalLiabilities: 1000,
  totalEquity: 1000,
  currentAssets: 600,
  currentLiabilities: 300,
  totalDebt: 400,
  cash: 100,
  operatingCashFlow: 150,
  capex: 50,
  sharesOutstanding: 10,
  ...over,
});

const flatModel = (over: Partial<ProjectionModel> = {}): ProjectionModel => ({
  price: 120,
  eps0: 10,
  pe0: 12,
  years: 3,
  sectorGrowth: 0.1,
  meanReversion: 0,
  minGrowth: -0.1,
  maxGrowth: 0.3,
  minExitPe: 4,
  maxExitPe: 25,
  qualGrowthCap: 0.03,
  qualMultipleCap: 0.15,
  tiltCap: 0.1,
  ddm: null,
  ...over,
});

const scores = (v: number): FactorScore[] =>
  FACTOR_KEYS.map((key) => ({ key, score: v, justification: "", evidence: [] }));

describe("ratios", () => {
  it("computes CAGR and rejects non-positive ends", () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1, 10);
    expect(cagr(-5, 10, 2)).toBeNull();
    expect(cagr(10, 20, 0)).toBeNull();
    expect(seriesCagr([{ year: 2021, value: 10 }, { year: 2022, value: null }, { year: 2023, value: 12.1 }])).toBeCloseTo(0.1, 10);
  });

  it("derives EPS from net income and shares when EPS is missing", () => {
    expect(epsOf(year(2025, { eps: null, netIncome: 250, sharesOutstanding: 50 }))).toBe(5);
    expect(epsOf(year(2025, { eps: null, sharesOutstanding: null }), 20)).toBe(5);
  });

  it("computes the standard ratios", () => {
    const r = computeRatios([year(2023, { eps: 8.264462809917354 }), year(2024, { eps: 9.090909090909092 }), year(2025)], 120);
    expect(r.eps).toBe(10);
    expect(r.epsCagr).toBeCloseTo(0.1, 6);
    expect(r.pe).toBe(12);
    expect(r.roe).toBe(0.1);
    expect(r.roa).toBe(0.05);
    expect(r.netMargin).toBe(0.1);
    expect(r.debtToEquity).toBe(0.4);
    expect(r.currentRatio).toBe(2);
    expect(r.payoutRatio).toBe(0.4);
    expect(r.dividendYield).toBeCloseTo(4 / 120, 10);
    expect(r.bvps).toBe(100);
    expect(r.pb).toBe(1.2);
    expect(r.fcf).toBe(100);
    expect(r.fcfYield).toBeCloseTo(100 / 1200, 10);
    expect(r.completeness.score).toBe(1);
    expect(r.yearsOfHistory).toBe(3);
  });

  it("flags missing fields and uses a newer interim balance sheet for leverage", () => {
    const r = computeRatios([year(2025, { operatingCashFlow: null, dps: null })], 100, {
      latestBalance: { totalDebt: 200, totalEquity: 1000 },
    });
    expect(r.completeness.missing).toEqual(["operatingCashFlow", "dps"]);
    expect(r.completeness.score).toBeCloseTo(6 / 8, 10);
    expect(r.debtToEquity).toBe(0.2);
  });
});

describe("projection building blocks", () => {
  it("projects EPS 10, growth 10 %, P/E 12 to the expected prices", () => {
    const rows = projectPath(10, [0.1, 0.1, 0.1], [12, 12, 12]);
    expect(rows.map((r) => r.price)).toEqual([
      expect.closeTo(132, 8),
      expect.closeTo(145.2, 8),
      expect.closeTo(159.72, 8),
    ]);
    expect(rows[2].eps).toBeCloseTo(13.31, 8);
  });

  it("blends growth over the components that exist", () => {
    const w = DEFAULT_VALUATION_SETTINGS.growthWeights;
    const lim = { minGrowth: -0.1, maxGrowth: 0.3 };
    expect(blendGrowth({ historical: 0.2, sustainable: 0.1, sector: 0.05 }, w, lim).growth).toBeCloseTo(0.4 * 0.2 + 0.3 * 0.1 + 0.3 * 0.05, 10);
    const partial = blendGrowth({ historical: null, sustainable: 0.1, sector: 0.04 }, w, lim);
    expect(partial.weights.historical).toBe(0);
    expect(partial.growth).toBeCloseTo(0.5 * 0.1 + 0.5 * 0.04, 10);
    expect(blendGrowth({ historical: 0.9, sustainable: 0.9, sector: 0.9 }, w, lim).growth).toBe(0.3);
  });

  it("computes sustainable growth from ROE and retention", () => {
    expect(sustainableGrowth(0.2, 0.4)).toBeCloseTo(0.12, 10);
    expect(sustainableGrowth(-0.1, 0.4)).toBeNull();
    expect(sustainableGrowth(0.15, null)).toBe(0.15);
  });

  it("mean-reverts growth toward the sector each year", () => {
    const p = growthPath(0.2, 0.08, 0.5, 3, { minGrowth: -0.1, maxGrowth: 0.3 });
    expect(p[0]).toBeCloseTo(0.2, 10);
    expect(p[1]).toBeCloseTo(0.14, 10);
    expect(p[2]).toBeCloseTo(0.11, 10);
  });

  it("moves the exit multiple toward the sector P/E within limits", () => {
    expect(quantExitPe(13.5, 11.5, 0.5, { minExitPe: 4, maxExitPe: 25 })).toBeCloseTo(12.5, 10);
    expect(quantExitPe(40, 30, 0.5, { minExitPe: 4, maxExitPe: 25 })).toBe(25);
    expect(pePath(12, 15, 3)).toEqual([13, 14, 15]);
  });
});

describe("qualitative overlay", () => {
  it("averages factor scores with weights and maps them to 0–100", () => {
    expect(compositeScore(scores(0.5), DEFAULT_VALUATION_SETTINGS.factorWeights)).toBeCloseTo(0.5, 10);
    expect(compositeScore([], DEFAULT_VALUATION_SETTINGS.factorWeights)).toBe(0);
    expect(compositeScore(scores(5), DEFAULT_VALUATION_SETTINGS.factorWeights)).toBe(1);
    expect(toHundred(0)).toBe(50);
    expect(toHundred(1)).toBe(100);
    expect(toHundred(-1)).toBe(0);
  });

  it("caps the growth and multiple shifts", () => {
    expect(overlayShifts(1, { qualGrowthCap: 0.03, qualMultipleCap: 0.15 })).toEqual({ growthShift: 0.03, multipleShift: 0.15 });
    expect(overlayShifts(-7, { qualGrowthCap: 0.03, qualMultipleCap: 0.15 })).toEqual({ growthShift: -0.03, multipleShift: -0.15 });
  });

  it("never moves the price by more than the tilt cap", () => {
    const m = flatModel();
    for (const tilt of [-1, -0.5, 0.5, 1]) {
      const run = runScenario(m, { growth: 0.1, exitPe: 12, tilt });
      run.rows.forEach((r, i) => {
        const q = run.quantPrices[i];
        expect(r.price).toBeLessThanOrEqual(q * 1.1 + 1e-9);
        expect(r.price).toBeGreaterThanOrEqual(q * 0.9 - 1e-9);
      });
      expect(Math.abs(run.tiltPct)).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(Math.sign(run.tiltPct)).toBe(Math.sign(tilt));
    }
  });

  it("leaves the quantitative path untouched when the composite is neutral", () => {
    const run = runScenario(flatModel(), { growth: 0.1, exitPe: 12, tilt: 0 });
    expect(run.rows.map((r) => r.price)).toEqual(run.quantPrices);
    expect(run.rows[2].price).toBeCloseTo(159.72, 8);
    expect(run.tiltPct).toBe(0);
  });

  it("builds bounded heuristic scores from insights", () => {
    const f = heuristicFactorScores(
      [
        { category: "risk", sentiment: -0.8, impact: "high", summary: "Customer concentration.", evidenceQuote: "46% of volume", page: 58 },
        { category: "outlook", sentiment: 0.6, impact: "med", summary: "New warehouse capacity." },
      ],
      [{ title: "New contract", sentiment: 0.5, date: "2026-09-01" }],
    );
    expect(f).toHaveLength(6);
    for (const s of f) expect(Math.abs(s.score)).toBeLessThanOrEqual(1);
    expect(f.find((x) => x.key === "risk_profile")!.score).toBeLessThan(0);
    expect(f.find((x) => x.key === "growth_outlook")!.score).toBeGreaterThan(0);
    expect(f.find((x) => x.key === "governance")!.score).toBe(0);
    expect(f.find((x) => x.key === "risk_profile")!.evidence[0].page).toBe(58);
  });
});

describe("scenarios", () => {
  it("orders bear ≤ base ≤ bull for every year", () => {
    const cases: [ProjectionModel, number, number][] = [
      [flatModel(), 0.1, 12],
      [flatModel({ meanReversion: 0.3, sectorGrowth: 0.05 }), 0.25, 20],
      [flatModel({ maxExitPe: 12.5 }), 0.29, 12.4],
      [flatModel({ ddm: { weight: 0.3, costOfEquity: 0.14, terminalGrowth: 0.05, payoutRatio: 0.5 } }), -0.05, 6],
    ];
    for (const [model, growth, exitPe] of cases) {
      for (const tilt of [-1, 0, 1]) {
        const { set } = buildScenarios(model, { growth, exitPe, tilt }, DEFAULT_VALUATION_SETTINGS.scenario);
        for (const y of ["y1", "y2", "y3"] as const) {
          expect(set.bear[y]).toBeLessThanOrEqual(set.base[y]);
          expect(set.base[y]).toBeLessThanOrEqual(set.bull[y]);
        }
      }
    }
  });

  it("blends in the dividend-discount value", () => {
    const ddm = { weight: 0.2, costOfEquity: 0.14, terminalGrowth: 0.06, payoutRatio: 0.4 };
    const run = runScenario(flatModel({ ddm }), { growth: 0.1, exitPe: 12, tilt: 0 });
    const eps3 = 13.31;
    const ddmValue = (eps3 * 0.4 * 1.06) / 0.08;
    expect(run.rows[2].price).toBeCloseTo(0.8 * 159.72 + 0.2 * ddmValue, 6);
  });
});

describe("confidence and score", () => {
  it("rewards complete, stable, recent data", () => {
    const history = [2021, 2022, 2023, 2024, 2025].map((y, i) => year(y, { eps: 10 * 1.1 ** i }));
    const ratios = computeRatios(history, 150);
    const tight = { bear: { y1: 1, y2: 1, y3: 95 }, base: { y1: 1, y2: 1, y3: 100 }, bull: { y1: 1, y2: 1, y3: 120 } };
    const good = confidenceScore({ ratios, factorScores: scores(0.3), scenarios: tight, latestPeriodEnd: "2026-06-30", asOf: new Date("2026-10-17") });
    const wide = { ...tight, bear: { y1: 1, y2: 1, y3: 40 }, bull: { y1: 1, y2: 1, y3: 200 } };
    const poor = confidenceScore({
      ratios: computeRatios([year(2023, { operatingCashFlow: null, dps: null, totalDebt: null })], 150),
      factorScores: [...scores(0.9).slice(0, 3), ...scores(-0.9).slice(3)],
      scenarios: wide,
      latestPeriodEnd: "2023-12-31",
      asOf: new Date("2026-10-17"),
    });
    expect(good.score).toBeGreaterThan(85);
    expect(poor.score).toBeLessThan(40);
    expect(good.score).toBeLessThanOrEqual(100);
    expect(poor.score).toBeGreaterThanOrEqual(0);
  });

  it("weights the AutoVise score", () => {
    expect(upsideToScore(-0.3)).toBe(0);
    expect(upsideToScore(0.6)).toBeCloseTo(100, 10);
    const s = autoviseScore({ upside: 0.15, composite: 0, confidence: 80 }, { upside: 40, quality: 40, confidence: 20 });
    expect(s.score).toBe(Math.round(0.4 * 50 + 0.4 * 50 + 0.2 * 80));
  });
});

describe("valueCompany", () => {
  const input = (over: Partial<ValuationInput> = {}): ValuationInput => ({
    price: 120,
    priceDate: "2026-10-16",
    history: [2021, 2022, 2023, 2024, 2025].map((y, i) => year(y, { eps: 10 / 1.1 ** (4 - i), netIncome: 100 / 1.1 ** (4 - i) })),
    latestPeriodEnd: "2025-12-31",
    sector: { name: "Logistics", pe: 11, growth: 0.08, roe: 0.12 },
    factorScores: scores(0.2),
    asOf: new Date("2026-10-17T00:00:00Z"),
    settings: DEFAULT_VALUATION_SETTINGS,
    ...over,
  });

  it("is deterministic", () => {
    expect(JSON.stringify(valueCompany(input()))).toBe(JSON.stringify(valueCompany(input())));
  });

  it("produces a waterfall that adds up to the base target", () => {
    const out = valueCompany(input());
    if (!out.ok) throw new Error(out.reason);
    const { waterfall, scenarios } = out.result;
    const steps = waterfall.filter((w) => w.key !== "current" && w.key !== "target");
    const sum = waterfall[0].value + steps.reduce((a, w) => a + w.value, 0);
    expect(sum).toBeCloseTo(scenarios.base.y3, 8);
    expect(waterfall[waterfall.length - 1].value).toBeCloseTo(scenarios.base.y3, 8);
    expect(out.result.upsidePct).toBeCloseTo(scenarios.base.y3 / 120 - 1, 10);
    expect(out.result.assumptions.horizonDate).toBe("2029-10-17");
  });

  it("moves the target the right way with qualitative scores, within the cap", () => {
    const neutral = valueCompany(input({ factorScores: scores(0) }));
    const strong = valueCompany(input({ factorScores: scores(1) }));
    const weak = valueCompany(input({ factorScores: scores(-1) }));
    if (!neutral.ok || !strong.ok || !weak.ok) throw new Error("valuation failed");
    const n = neutral.result.scenarios.base.y3;
    expect(strong.result.scenarios.base.y3).toBeGreaterThan(n);
    expect(weak.result.scenarios.base.y3).toBeLessThan(n);
    expect(strong.result.scenarios.base.y3 / n - 1).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(1 - weak.result.scenarios.base.y3 / n).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it("refuses to value a company without positive EPS or a price", () => {
    expect(valueCompany(input({ history: [year(2025, { eps: -2, netIncome: -20 })] })).ok).toBe(false);
    expect(valueCompany(input({ price: 0 })).ok).toBe(false);
    expect(valueCompany(input({ history: [] })).ok).toBe(false);
  });

  it("builds the waterfall from a scenario run", () => {
    const run = runScenario(flatModel(), { growth: 0.1, exitPe: 15, tilt: 0 });
    const wf = buildWaterfall(120, 12, run);
    expect(wf.map((w) => w.key)).toEqual(["current", "earnings", "multiple", "qualitative", "target"]);
    expect(wf[1].value).toBeCloseTo(13.31 * 12 - 120, 8);
    expect(wf[2].value).toBeCloseTo(13.31 * 15 - 13.31 * 12, 8);
  });
});

describe("buildHistory", () => {
  const row = (over: Partial<MetricRow>): MetricRow => ({
    fiscalYear: 2025,
    period: "FY",
    unitMultiplier: 1_000_000,
    revenue: 100,
    grossProfit: null,
    operatingIncome: null,
    netIncome: 10,
    eps: 2,
    dps: null,
    totalAssets: null,
    totalLiabilities: null,
    totalEquity: 50,
    currentAssets: null,
    currentLiabilities: null,
    totalDebt: 20,
    cash: null,
    operatingCashFlow: null,
    capex: null,
    sharesOutstanding: 5_000_000,
    ...over,
  });

  it("scales statement figures but not per-share figures", () => {
    const { history } = buildHistory([row({})]);
    expect(history[0].revenue).toBe(100_000_000);
    expect(history[0].eps).toBe(2);
    expect(history[0].sharesOutstanding).toBe(5_000_000);
  });

  it("prefers the newer report for a year and fills gaps from older ones", () => {
    const { history } = buildHistory([
      row({ revenue: 100, dps: 1, createdAt: "2025-03-01" }),
      row({ revenue: 105, dps: null, createdAt: "2026-03-01" }),
      row({ fiscalYear: 2024, revenue: 90, createdAt: "2025-03-01" }),
    ]);
    expect(history.map((h) => h.year)).toEqual([2024, 2025]);
    expect(history[1].revenue).toBe(105_000_000);
    expect(history[1].dps).toBe(1);
  });

  it("takes the latest balance sheet from interim periods", () => {
    const { latestBalance, latestPeriodEnd } = buildHistory([
      row({ periodEnd: "2025-12-31" }),
      row({ fiscalYear: 2026, period: "Q2", totalDebt: 10, totalEquity: 60, periodEnd: "2026-06-30" }),
    ]);
    expect(latestBalance?.totalDebt).toBe(10_000_000);
    expect(latestPeriodEnd).toBe("2026-06-30");
  });
});

describe("discounted cash flow", () => {
  const dcf = { weight: 0.3, costOfEquity: 0.14, terminalGrowth: 0.05, fcfConversion: 0.8, fadeYears: 5 };

  it("equals the Gordon growth value when growth is constant", () => {
    const g = 0.05;
    const growth = Array(8).fill(g);
    for (const n of [1, 2, 3]) {
      const epsN = 10 * (1 + g) ** n;
      const gordon = (epsN * 0.8 * (1 + g)) / (0.14 - g);
      expect(dcfValueAt(10, growth, n, dcf)).toBeCloseTo(gordon, 8);
    }
  });

  it("fades growth to the terminal rate", () => {
    const path = fadeGrowth([0.2, 0.15, 0.1], 0.05, 5, 8);
    expect(path).toHaveLength(8);
    expect(path[3]).toBeCloseTo(0.09, 10);
    expect(path[7]).toBeCloseTo(0.05, 10);
  });

  it("refuses a terminal growth at or above the cost of equity", () => {
    expect(dcfValueAt(10, Array(8).fill(0.05), 3, { ...dcf, terminalGrowth: 0.14 })).toBeNull();
  });

  it("takes the median cash conversion over years with complete data", () => {
    expect(
      fcfConversion([
        { netIncome: 100, operatingCashFlow: 150, capex: 50 },
        { netIncome: 100, operatingCashFlow: 120, capex: -40 },
        { netIncome: 100, operatingCashFlow: 200, capex: 50 },
        { netIncome: -5, operatingCashFlow: 10, capex: 1 },
        { netIncome: 100, operatingCashFlow: null, capex: 10 },
      ]),
    ).toBeCloseTo(1, 10);
    expect(fcfConversion([])).toBeNull();
  });

  it("blends P/E, DCF and dividend values by weight", () => {
    const model = flatModel({
      dcf,
      ddm: { weight: 0.1, costOfEquity: 0.14, terminalGrowth: 0.05, payoutRatio: 0.4 },
    });
    const run = runScenario(model, { growth: 0.1, exitPe: 12, tilt: 0 });
    const m = run.quantMethods;
    expect(m.weights[2]).toEqual({ pe: expect.closeTo(0.6, 10), dcf: 0.3, ddm: 0.1 });
    expect(run.quantPrices[2]).toBeCloseTo(0.6 * m.pe[2] + 0.3 * m.dcf[2]! + 0.1 * m.ddm[2]!, 8);
    expect(m.pe[2]).toBeCloseTo(159.72, 8);
  });

  it("is skipped for sectors where it is not meaningful, and the waterfall still adds up", () => {
    const base = {
      price: 120,
      priceDate: "2026-10-16",
      history: [2023, 2024, 2025].map((y, i) => year(y, { eps: 8 * 1.1 ** i, netIncome: 80 * 1.1 ** i })),
      latestPeriodEnd: "2025-12-31",
      factorScores: scores(0.2),
      asOf: new Date("2026-10-17T00:00:00Z"),
      settings: DEFAULT_VALUATION_SETTINGS,
    };
    const withDcf = valueCompany({ ...base, sector: { name: "Logistics", pe: 11, growth: 0.08, roe: 0.12 } });
    const bank = valueCompany({ ...base, sector: { name: "Banking", pe: 11, growth: 0.08, roe: 0.12, dcf: false } });
    if (!withDcf.ok || !bank.ok) throw new Error("valuation failed");
    expect(withDcf.result.assumptions.dcf).not.toBeNull();
    expect(withDcf.result.waterfall.some((w) => w.key === "dcf")).toBe(true);
    expect(bank.result.assumptions.dcf).toBeNull();
    expect(bank.result.assumptions.methods?.weights.dcf).toBe(0);
    expect(bank.result.assumptions.notes.join(" ")).toContain("Banking");
    for (const r of [withDcf.result, bank.result]) {
      const sum = r.waterfall.filter((w) => w.key !== "target").reduce((a, w) => a + w.value, 0);
      expect(sum).toBeCloseTo(r.scenarios.base.y3, 8);
    }
  });
});
