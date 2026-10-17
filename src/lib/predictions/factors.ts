import "server-only";
import { generateObject } from "ai";
import { models } from "@/lib/ai/gemini";
import { QUALITATIVE_SYSTEM, qualitativeUserPrompt } from "@/lib/ai/prompts/qualitative";
import { factorScoresSchema } from "@/lib/ai/schemas";
import { env } from "@/lib/env";
import { heuristicFactorScores } from "@/lib/valuation/qualitative";
import { FACTOR_KEYS, type FactorScore } from "@/lib/valuation/types";
import type { CompanyInputs } from "./inputs";
import type { SourceList } from "./sources";

/**
 * Gemini Flash rates the six qualitative factors (−1..+1) with justifications and cited evidence.
 * Falls back to the deterministic heuristic when Gemini is unavailable or the answer is invalid.
 * Either way the scores only shift the valuation within the caps in settings.
 */
export async function scoreFactors(inputs: CompanyInputs, sources: SourceList): Promise<{ scores: FactorScore[]; by: "gemini" | "heuristic" }> {
  const heuristic = () =>
    heuristicFactorScores(
      inputs.insights.map((i) => {
        const id = sources.byInsight.get(i.id);
        const c = sources.citations.find((x) => x.id === id);
        return { ...i, label: c?.label ?? null };
      }),
      inputs.events,
    );

  if (!env.hasGemini || sources.citations.length === 0) return { scores: heuristic(), by: "heuristic" };

  try {
    const { object } = await generateObject({
      model: models.flash(),
      schema: factorScoresSchema,
      system: QUALITATIVE_SYSTEM,
      prompt: qualitativeUserPrompt({ companyName: inputs.company.name, sector: inputs.sector.name, sources: sources.text }),
      temperature: 0,
      maxRetries: 2,
    });
    const byKey = new Map(object.factors.map((f) => [f.key, f]));
    if (byKey.size !== FACTOR_KEYS.length) throw new Error("Factor list incomplete");
    const cites = new Map(sources.citations.map((c) => [c.id, c]));
    const scores = FACTOR_KEYS.map((key) => {
      const f = byKey.get(key)!;
      return {
        key,
        score: Math.max(-1, Math.min(1, f.score)),
        justification: f.justification,
        evidence: f.evidence
          .filter((e) => cites.has(e.sourceId))
          .map((e) => {
            const c = cites.get(e.sourceId)!;
            return { quote: c.quote ?? e.quote, page: c.page, reportVersionId: c.reportVersionId, label: c.label };
          }),
      };
    });
    return { scores, by: "gemini" };
  } catch (err) {
    console.warn("[factors] Gemini scoring failed, using heuristic:", (err as Error).message);
    return { scores: heuristic(), by: "heuristic" };
  }
}
