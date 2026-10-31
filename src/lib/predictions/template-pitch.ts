import { extractNumbers } from "@/lib/ai/grounding";
import type { PitchContent } from "@/lib/ai/schemas";
import { num } from "@/lib/format";
import type { PitchFacts } from "./facts";

export interface SourcedInsight {
  sourceId: string;
  category: string;
  summary: string;
  sentiment: number;
  impact: "low" | "med" | "high";
}

const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
const pctS = (v: number) => `${sign(v)}${num(Math.abs(v), 1)}%`;
const pctU = (v: number) => `${num(v, 1)}%`;
const strip = (s: string) => s.replace(/\.\s*$/, "");
const IMPACT = { high: 3, med: 2, low: 1 } as const;

/**
 * Deterministic pitch written from the computed facts and the extracted insights. Used when Gemini
 * is not configured or its pitch fails validation. Every number comes from `facts` or an insight.
 */
export function templatePitch(f: PitchFacts, insights: SourcedInsight[]): PitchContent {
  const m = (v: number) => `${f.currency} ${num(v)}`;
  const byImpact = [...insights].sort((a, b) => IMPACT[b.impact] - IMPACT[a.impact] || Math.abs(b.sentiment) - Math.abs(a.sentiment));
  const positives = byImpact.filter((i) => i.sentiment > 0.15 && i.category !== "risk");
  const negatives = byImpact.filter((i) => i.sentiment < -0.15 || i.category === "risk");
  const catalysts = byImpact.filter((i) => ["outlook", "strategy", "capital_allocation"].includes(i.category) && i.sentiment >= 0);

  const earnings = f.waterfall.find((w) => w.step === "Earnings growth")?.value ?? 0;
  const multipleStep = f.waterfall.find((w) => w.step === "Multiple change")?.value ?? 0;
  const up = f.upsidePct.base >= 0;

  const headline = !up
    ? `At ${m(f.price)} the price runs ahead of the earnings; our base case is ${m(f.target.base)}.`
    : earnings >= Math.abs(multipleStep)
      ? `Earnings growth, not a re-rating, carries ${f.ticker} to ${m(f.target.base)}.`
      : `A higher multiple does most of the work toward ${m(f.target.base)}.`;

  const lead = positives[0];
  const thesis1 = `We see ${m(f.target.base)} as fair value for ${f.company} by ${f.horizon}, ${pctS(f.upsidePct.base)} against today's ${m(f.price)}.${lead ? ` ${strip(lead.summary)}.` : ""}`;
  const premium = f.pe.now > f.pe.sector;
  const thesis2 = `The market pays ${num(f.pe.now, 1)}× earnings, ${premium ? "above" : "below"} the sector benchmark of ${num(f.pe.sector, 1)}×. We assume the multiple moves to ${num(f.pe.exit, 1)}× by year three, so ${earnings >= Math.abs(multipleStep) ? "most of the change comes from what the company earns, not from what investors pay for it" : "the re-rating matters more than earnings growth in this view"}.`;

  const drivers: PitchContent["drivers"] = [];
  if (f.growthPct.historical !== null) {
    drivers.push({ figure: pctS(f.growthPct.historical), title: "Earnings record", body: `EPS has compounded at ${pctU(f.growthPct.historical)} a year over the reported history.`, cites: [] });
  }
  for (const p of positives.slice(0, 2)) {
    const n = extractNumbers(p.summary)[0];
    let figure = "";
    if (n) {
      const after = p.summary[p.summary.indexOf(n.raw) + n.raw.length];
      figure = n.raw.replace(/^-/, "−") + (after === "%" ? "%" : "");
    }
    drivers.push({ figure: figure.slice(0, 16), title: titleOf(p.category), body: strip(p.summary).slice(0, 290) + ".", cites: [p.sourceId] });
  }
  if (f.ratios.roePct !== null && drivers.length < 4) {
    drivers.push({
      figure: pctU(f.ratios.roePct),
      title: "Return on equity",
      body: `Return on equity of ${pctU(f.ratios.roePct)}${f.ratios.sectorRoePct !== null ? ` against a sector benchmark of ${pctU(f.ratios.sectorRoePct)}` : ""}.`,
      cites: [],
    });
  }
  if (drivers.length < 2 && f.ratios.debtToEquity !== null) {
    drivers.push({ figure: `${num(f.ratios.debtToEquity, 2)}×`, title: "Balance sheet", body: `Debt to equity stands at ${num(f.ratios.debtToEquity, 2)}.`, cites: [] });
  }
  if (drivers.length < 2) {
    drivers.push({ figure: pctU(f.growthPct.blended), title: "Growth assumption", body: `We assume EPS growth of ${pctU(f.growthPct.blended)} in the first year, easing toward the sector's ${pctU(f.growthPct.sector)}.`, cites: [] });
  }

  const qualWord = f.qualitative.priceEffectPct >= 0 ? "adds" : "takes off";
  const valuation = [
    {
      text: `We start from ${f.eps.baseYear ?? "latest"} EPS of ${m(f.eps.base)} and grow it at ${pctU(f.growthPct.blended)} in the first year, easing toward the sector's ${pctU(f.growthPct.sector)}, to reach ${m(f.eps.year3)} in year three.`,
    },
    {
      text: `We then apply an exit P/E of ${num(f.pe.exitBeforeQualitative, 1)}×, moving from today's ${num(f.pe.now, 1)}× toward the sector benchmark. The qualitative factors score ${f.qualitative.compositeScore} out of 100; their small shift to growth and to the multiple (${num(f.pe.exit, 1)}× at exit) ${qualWord} ${pctU(Math.abs(f.qualitative.priceEffectPct))}, giving a base case of ${m(f.target.base)}.`,
    },
  ];

  const used = new Set(drivers.flatMap((d) => d.cites));
  const mt = f.methods;
  if (mt && mt.dcfValue !== null && mt.cashConversionPct !== null && mt.costOfEquityPct !== null) {
    valuation.push({
      text: `As a cross-check, a discounted cash flow model values the shares at ${m(mt.dcfValue)} in year three, converting ${pctU(mt.cashConversionPct)} of profit into free cash flow and discounting at ${pctU(mt.costOfEquityPct)}. The target blends the P/E value (${mt.weightsPct.pe}%), the DCF value (${mt.weightsPct.dcf}%)${mt.dividendValue !== null ? ` and a dividend-discount value (${mt.weightsPct.dividend}%)` : ""}.`,
    });
  }

  const risks: PitchContent["risks"] = uniqueTitles(negatives.slice(0, 3).map((n) => ({ title: titleOf(n.category), body: strip(n.summary).slice(0, 290) + ".", cites: [n.sourceId] })));
  if (premium && risks.length < 3) {
    risks.push({ title: "Valuation premium", body: `The shares trade at ${num(f.pe.now, 1)}× earnings against ${num(f.pe.sector, 1)}× for the sector; if the premium closes faster, the target falls.`, cites: [] });
  }
  if (f.ratios.debtToEquity !== null && f.ratios.debtToEquity > 1 && risks.length < 4) {
    risks.push({ title: "Leverage", body: `Debt to equity of ${num(f.ratios.debtToEquity, 2)} leaves less room if earnings disappoint.`, cites: [] });
  }
  if (risks.length === 0) risks.push({ title: "Earnings delivery", body: "The view depends on earnings growing as assumed; a weaker year would move the target toward the bear case.", cites: [] });

  const cats: PitchContent["catalysts"] = uniqueTitles(
    catalysts
      .filter((c) => !used.has(c.sourceId))
      .slice(0, 2)
      .map((c) => ({ title: titleOf(c.category), body: strip(c.summary).slice(0, 290) + ".", cites: [c.sourceId] })),
  );
  if (cats.length === 0) cats.push({ title: "Next reported results", body: "The next report will be processed as soon as it is filed, and this prediction recalculated.", cites: [] });

  return {
    thesis: { headline: headline.slice(0, 160), paragraphs: [{ text: thesis1, cites: lead ? [lead.sourceId] : [] }, { text: thesis2, cites: [] }] },
    drivers: drivers.slice(0, 4),
    valuation: { paragraphs: valuation },
    risks: risks.slice(0, 4),
    catalysts: cats,
    changeView: {
      bull: `EPS growth about ${num(f.growthPct.scenarioShiftPoints, 1)} points a year above our path, with the market paying near ${num(f.pe.bullExit, 1)}× earnings, would point to the bull case of ${m(f.target.bull)}.`,
      bear: `Growth ${num(f.growthPct.scenarioShiftPoints, 1)} points a year below our path and a multiple near ${num(f.pe.bearExit, 1)}× would point to the bear case of ${m(f.target.bear)}.`,
    },
  };
}

/** Category labels make poor titles when repeated; keep only the first of each. */
function uniqueTitles<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.map((i) => {
    if (seen.has(i.title)) return { ...i, title: "" };
    seen.add(i.title);
    return i;
  });
}

function titleOf(category: string): string {
  const t: Record<string, string> = {
    management: "Management",
    strategy: "Strategy",
    outlook: "Outlook",
    risk: "Risk",
    governance: "Governance",
    esg: "ESG",
    market: "Market position",
    capital_allocation: "Capital allocation",
  };
  return t[category] ?? "Insight";
}
