import { clamp, isNum } from "./math";
import { FACTOR_KEYS, type FactorKey, type FactorScore, type ValuationSettings } from "./types";

/** Weighted average of the six factor scores, −1..+1. Missing factors count as neutral (0). */
export function compositeScore(scores: FactorScore[], weights: Record<FactorKey, number>): number {
  let total = 0;
  let sum = 0;
  for (const key of FACTOR_KEYS) {
    const w = weights[key] ?? 0;
    if (w <= 0) continue;
    const s = scores.find((f) => f.key === key);
    sum += w * clamp(isNum(s?.score) ? s.score : 0, -1, 1);
    total += w;
  }
  return total > 0 ? clamp(sum / total, -1, 1) : 0;
}

/**
 * How the qualitative composite shifts the quantitative assumptions. Both shifts are capped by
 * settings, so qualitative factors can move the numbers but never override them.
 */
export function overlayShifts(
  composite: number,
  caps: Pick<ValuationSettings, "qualGrowthCap" | "qualMultipleCap">,
): { growthShift: number; multipleShift: number } {
  const s = clamp(composite, -1, 1);
  return { growthShift: s * caps.qualGrowthCap, multipleShift: s * caps.qualMultipleCap };
}

/** −1..+1 → 0..100, the scale shown to visitors. */
export const toHundred = (s: number) => Math.round((clamp(s, -1, 1) + 1) * 50);

export interface InsightLike {
  category: string;
  sentiment: number;
  impact: "low" | "med" | "high";
  summary: string;
  evidenceQuote?: string | null;
  page?: number | null;
  reportVersionId?: string | null;
  label?: string | null;
}

export interface EventLike {
  title: string;
  sentiment: number;
  date: string;
}

const CATEGORY_TO_FACTOR: Record<string, FactorKey[]> = {
  management: ["management"],
  capital_allocation: ["management"],
  strategy: ["growth_outlook", "competitive_position"],
  outlook: ["growth_outlook"],
  market: ["competitive_position"],
  risk: ["risk_profile"],
  governance: ["governance"],
  esg: ["governance"],
};

const IMPACT_WEIGHT = { low: 1, med: 2, high: 3 } as const;

/**
 * Deterministic factor scores from extracted insights and admin-entered events. Used when Gemini
 * is not configured or its answer fails validation, so a prediction can always be produced.
 * Each factor is the impact-weighted mean sentiment of the insights mapped to it.
 */
export function heuristicFactorScores(insights: InsightLike[], events: EventLike[]): FactorScore[] {
  const buckets = new Map<FactorKey, { sum: number; w: number; items: InsightLike[] }>();
  for (const k of FACTOR_KEYS) buckets.set(k, { sum: 0, w: 0, items: [] });

  for (const ins of insights) {
    const targets = CATEGORY_TO_FACTOR[ins.category] ?? [];
    const w = IMPACT_WEIGHT[ins.impact] ?? 1;
    for (const t of targets) {
      const b = buckets.get(t)!;
      b.sum += clamp(ins.sentiment, -1, 1) * w;
      b.w += w;
      b.items.push(ins);
    }
    // Every insight also feeds overall sentiment at half weight.
    const s = buckets.get("sentiment")!;
    s.sum += clamp(ins.sentiment, -1, 1) * w * 0.5;
    s.w += w * 0.5;
  }
  for (const ev of events) {
    const s = buckets.get("sentiment")!;
    s.sum += clamp(ev.sentiment, -1, 1) * 2;
    s.w += 2;
  }

  return FACTOR_KEYS.map((key) => {
    const b = buckets.get(key)!;
    // Shrink toward neutral when evidence is thin: one low-impact insight should not max a factor.
    const raw = b.w > 0 ? b.sum / b.w : 0;
    const shrink = b.w / (b.w + 2);
    const score = Math.round(raw * shrink * 100) / 100;
    const top = [...b.items].sort((a, c) => IMPACT_WEIGHT[c.impact] - IMPACT_WEIGHT[a.impact]).slice(0, 2);
    const justification =
      top.length > 0
        ? top.map((t) => t.summary.replace(/\.$/, "")).join("; ") + "."
        : key === "sentiment" && events.length
          ? `Based on ${events.length} recent company event${events.length === 1 ? "" : "s"}.`
          : "No specific evidence in the current reports; treated as neutral.";
    return {
      key,
      score,
      justification,
      evidence: top
        .filter((t) => t.evidenceQuote)
        .map((t) => ({ quote: t.evidenceQuote!, page: t.page ?? null, reportVersionId: t.reportVersionId ?? null, label: t.label ?? null })),
    };
  });
}
