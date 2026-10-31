import { z } from "zod";
import { FACTOR_KEYS } from "@/lib/valuation/types";
import { ungroundedNumbers } from "./grounding";

// ─── Report extraction ────────────────────────────────────────────────────
export const METRIC_FIELDS = [
  "revenue",
  "grossProfit",
  "operatingIncome",
  "netIncome",
  "eps",
  "dps",
  "totalAssets",
  "totalLiabilities",
  "totalEquity",
  "currentAssets",
  "currentLiabilities",
  "totalDebt",
  "cash",
  "operatingCashFlow",
  "capex",
  "sharesOutstanding",
] as const;
export type MetricField = (typeof METRIC_FIELDS)[number];

export const METRIC_LABELS: Record<MetricField, string> = {
  revenue: "Revenue",
  grossProfit: "Gross profit",
  operatingIncome: "Operating profit",
  netIncome: "Net income (to shareholders)",
  eps: "EPS",
  dps: "Dividend per share",
  totalAssets: "Total assets",
  totalLiabilities: "Total liabilities",
  totalEquity: "Total equity",
  currentAssets: "Current assets",
  currentLiabilities: "Current liabilities",
  totalDebt: "Total borrowings",
  cash: "Cash and equivalents",
  operatingCashFlow: "Operating cash flow",
  capex: "Capital expenditure",
  sharesOutstanding: "Shares outstanding",
};

/** Per-share and count fields are never scaled by the unit multiplier. */
export const UNSCALED_FIELDS: MetricField[] = ["eps", "dps", "sharesOutstanding"];

const extractedValue = z.object({
  value: z.number().nullable().describe("The figure exactly as printed in the statement's units; null if not reported"),
  page: z.number().int().nullable().describe("1-based PDF page (or sheet row) where the figure appears"),
  confidence: z.number().min(0).max(100).describe("How sure you are that this is the right line item and period, 0–100"),
});

export const extractionSchema = z.object({
  currency: z.string().length(3).describe("ISO currency code of the statements, e.g. LKR"),
  unitMultiplier: z
    .number()
    .positive()
    .describe("Statement units: 1 for units, 1000 for thousands, 1000000 for millions, 1000000000 for billions"),
  periods: z
    .array(
      z.object({
        fiscalYear: z.number().int().min(1990).max(2100),
        period: z.enum(["FY", "H1", "Q1", "Q2", "Q3", "Q4", "9M"]),
        periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        metrics: z.object(Object.fromEntries(METRIC_FIELDS.map((f) => [f, extractedValue])) as Record<MetricField, typeof extractedValue>),
      }),
    )
    .min(1)
    .max(6)
    .describe("The current period first, then comparative periods shown in the same report"),
  insights: z
    .array(
      z.object({
        category: z.enum(["management", "strategy", "outlook", "risk", "governance", "esg", "market", "capital_allocation"]),
        summary: z.string().min(10).max(300),
        sentiment: z.number().min(-1).max(1),
        impact: z.enum(["low", "med", "high"]),
        evidenceQuote: z.string().min(10).max(600).describe("Verbatim sentence from the report"),
        page: z.number().int().nullable(),
      }),
    )
    .max(25),
});
export type Extraction = z.infer<typeof extractionSchema>;

// ─── Qualitative factor scores ────────────────────────────────────────────
export const factorScoresSchema = z.object({
  factors: z
    .array(
      z.object({
        key: z.enum(FACTOR_KEYS),
        score: z.number().min(-1).max(1),
        justification: z.string().min(10).max(220),
        evidence: z.array(z.object({ sourceId: z.string(), quote: z.string().max(400) })).max(3),
      }),
    )
    .length(6),
});

// ─── Pitch ────────────────────────────────────────────────────────────────
export interface Citation {
  id: string;
  label: string;
  reportId: string | null;
  reportVersionId: string | null;
  versionNo: number | null;
  page: number | null;
  quote: string | null;
  section?: string | null;
}

const cites = z.array(z.string()).max(4).describe("Source ids such as S3 that support this text");

export const pitchContentSchema = z.object({
  thesis: z.object({
    headline: z.string().min(10).max(160),
    paragraphs: z.array(z.object({ text: z.string().min(20).max(900), cites })).min(1).max(3),
  }),
  drivers: z
    .array(z.object({ figure: z.string().max(16), title: z.string().max(60), body: z.string().max(300), cites }))
    .min(2)
    .max(4),
  valuation: z.object({ paragraphs: z.array(z.object({ text: z.string().min(20).max(900) })).min(1).max(3) }),
  risks: z.array(z.object({ title: z.string().max(60), body: z.string().max(300), cites })).min(1).max(5),
  catalysts: z.array(z.object({ title: z.string().max(80), body: z.string().max(300), cites })).min(1).max(4),
  changeView: z.object({ bull: z.string().min(10).max(300), bear: z.string().min(10).max(300) }),
});
export type PitchContent = z.infer<typeof pitchContentSchema>;

/**
 * An approved customer-evidence finding attached to the pitch verbatim (docs/PLAN2.md §7.6). Never
 * rewritten by the pitch model, and never used by the valuation.
 */
export interface CustomerEvidenceItem {
  section: "competitive_positioning" | "industry_overview" | "risks";
  text: string;
  support: "supports" | "contradicts" | "explains" | "qualifies";
  attribution: string;
  studyId: string;
  appendixPath: string | null;
}

export type Pitch = PitchContent & { generatedBy: "gemini" | "template"; model?: string | null; customerEvidence?: CustomerEvidenceItem[] };

/** Every string in the pitch, with a path for error messages. */
export function pitchStrings(p: PitchContent): [string, string][] {
  const out: [string, string][] = [["thesis.headline", p.thesis.headline]];
  p.thesis.paragraphs.forEach((x, i) => out.push([`thesis.paragraphs.${i}`, x.text]));
  p.drivers.forEach((x, i) => out.push([`drivers.${i}.figure`, x.figure], [`drivers.${i}.title`, x.title], [`drivers.${i}.body`, x.body]));
  p.valuation.paragraphs.forEach((x, i) => out.push([`valuation.paragraphs.${i}`, x.text]));
  p.risks.forEach((x, i) => out.push([`risks.${i}.title`, x.title], [`risks.${i}.body`, x.body]));
  p.catalysts.forEach((x, i) => out.push([`catalysts.${i}.title`, x.title], [`catalysts.${i}.body`, x.body]));
  out.push(["changeView.bull", p.changeView.bull], ["changeView.bear", p.changeView.bear]);
  return out;
}

/**
 * The pitch schema for one prediction: structurally the same as pitchContentSchema, but it rejects
 * any number in the text that is not among `allowed` (the computed figures and report evidence),
 * and any citation id that is not a known source.
 */
export function makePitchSchema(allowed: number[], sourceIds: string[]) {
  const known = new Set(sourceIds);
  return pitchContentSchema.superRefine((p, ctx) => {
    for (const [path, text] of pitchStrings(p)) {
      const bad = ungroundedNumbers(text, allowed);
      if (bad.length) {
        ctx.addIssue({ code: "custom", path: path.split("."), message: `Numbers not found in the inputs: ${bad.join(", ")}` });
      }
    }
    const allCites = [
      ...p.thesis.paragraphs.flatMap((x) => x.cites),
      ...p.drivers.flatMap((x) => x.cites),
      ...p.risks.flatMap((x) => x.cites),
      ...p.catalysts.flatMap((x) => x.cites),
    ];
    const unknown = allCites.filter((c) => !known.has(c));
    if (unknown.length) ctx.addIssue({ code: "custom", path: ["cites"], message: `Unknown source ids: ${[...new Set(unknown)].join(", ")}` });
  });
}

// ─── Chat ─────────────────────────────────────────────────────────────────
export const chatRequestSchema = z.object({
  slug: z.string().min(1).max(80),
  messages: z
    .array(
      z.object({
        id: z.string().max(100),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.object({ type: z.string() }).passthrough()).max(50),
      }).passthrough(),
    )
    .min(1)
    .max(40),
});

export const feedbackSchema = z.object({
  messageId: z.string().uuid(),
  vote: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
  reason: z.enum(["Didn’t answer", "Wrong number", "Out of date", "No date given", "Other"]).optional(),
  note: z.string().max(500).optional(),
});

// ─── Customer evidence (docs/PLAN2.md) ────────────────────────────────────
const evidenceSentiment = z.enum(["positive", "mixed", "negative", "unclear"]);
const evidenceProduct = z.enum(["mobile", "app", "home_broadband", "air_fibre", "fibre", "satellite", "unclear"]);

/** Coding of one customer record. Theme keys are limited to the study's own keys. */
export function makeEvidenceCodingSchema(themeKeys: string[]) {
  const keys = themeKeys.length ? (themeKeys as [string, ...string[]]) : (["none"] as [string, ...string[]]);
  return z.object({
    themes: z.array(z.enum(keys)).max(6).describe("Every study theme the record speaks to; may be empty"),
    sentiment: evidenceSentiment,
    switching: z.object({
      value: z.boolean().describe("True only for an explicit change of provider or a kept second connection"),
      explanation: z.string().max(300).nullable(),
    }),
    product_guess: evidenceProduct,
    product_evidence_quote: z.string().max(300).nullable().describe("Verbatim words that name the product; required for air_fibre"),
    language: z.enum(["en", "si", "ta", "mixed"]),
    translation_en: z.string().max(2000).nullable(),
    flags: z.object({
      advert: z.boolean(),
      hearsay: z.boolean(),
      not_first_hand: z.boolean(),
      overseas: z.boolean(),
      irrelevant: z.boolean(),
    }),
    confidence: z.number().min(0).max(1),
  });
}
export const EvidenceCodingSchema = makeEvidenceCodingSchema(["price_value", "network", "billing_app", "support", "switching", "install_availability"]);
export type EvidenceCoding = z.infer<typeof EvidenceCodingSchema>;

export const EvidenceFindingsSchema = z.object({
  sentences: z
    .array(
      z.object({
        text: z.string().min(20).max(400),
        support: z.enum(["supports", "contradicts", "explains", "qualifies"]),
        cited_record_codes: z.array(z.string().regex(/^R\d{3,}$/)).min(1).max(8),
      }),
    )
    .max(3),
  caveats: z.array(z.string().max(300)).max(4),
});
export type EvidenceFindings = z.infer<typeof EvidenceFindingsSchema>;
