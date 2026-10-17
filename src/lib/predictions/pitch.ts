import "server-only";
import { generateObject } from "ai";
import { collectNumbers, numberVariants } from "@/lib/ai/grounding";
import { models } from "@/lib/ai/gemini";
import { PITCH_SYSTEM, pitchUserPrompt } from "@/lib/ai/prompts/pitch";
import { makePitchSchema, pitchContentSchema, type Pitch } from "@/lib/ai/schemas";
import { env } from "@/lib/env";
import type { PitchFacts } from "./facts";
import type { SourceList } from "./sources";
import { templatePitch, type SourcedInsight } from "./template-pitch";

/**
 * Writes the pitch. Gemini Pro gets only the computed facts and the numbered sources; its answer is
 * checked so that every number exists in the inputs and every citation id is real. One retry with
 * the validation errors, then the deterministic template.
 */
export async function writePitch(facts: PitchFacts, sources: SourceList, insights: SourcedInsight[]): Promise<Pitch> {
  // 100 is allowed as the scale of scores ("74 out of 100").
  const allowed = numberVariants([...collectNumbers(facts), ...collectNumbers(sources.text), 100]);
  const schema = makePitchSchema(allowed, sources.citations.map((c) => c.id));
  const fallback = (): Pitch => {
    const t = templatePitch(facts, insights);
    // The template only uses computed numbers, but validate anyway so a bug can never publish an invented figure.
    const check = schema.safeParse(t);
    if (!check.success) console.warn("[pitch] template failed grounding:", check.error.issues.map((i) => i.message).join("; "));
    return { ...t, generatedBy: "template", model: null };
  };

  if (!env.hasGemini) return fallback();

  let feedback: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: models.pro(),
        schema: pitchContentSchema,
        system: PITCH_SYSTEM,
        prompt: pitchUserPrompt({ computed: facts, sources: sources.text, feedback }),
        temperature: 0.3,
        maxRetries: 2,
      });
      const check = schema.safeParse(object);
      if (check.success) return { ...check.data, generatedBy: "gemini", model: env.proModel };
      feedback = check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      console.warn(`[pitch] attempt ${attempt + 1} rejected: ${feedback}`);
    } catch (err) {
      console.warn(`[pitch] attempt ${attempt + 1} failed:`, (err as Error).message);
      feedback = "The response did not match the required structure.";
    }
  }
  return fallback();
}
