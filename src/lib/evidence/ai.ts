import "server-only";
import { generateObject } from "ai";
import { models } from "@/lib/ai/gemini";
import { EVIDENCE_CODE_SYSTEM, evidenceCodePrompt } from "@/lib/ai/prompts/evidence-code";
import { EVIDENCE_FINDINGS_SYSTEM, evidenceFindingsPrompt } from "@/lib/ai/prompts/evidence-findings";
import { EvidenceFindingsSchema, makeEvidenceCodingSchema, type EvidenceCoding, type EvidenceFindings } from "@/lib/ai/schemas";
import { env } from "@/lib/env";
import type { Matrix } from "./matrix";
import { offlineCode, offlineFindings } from "./offline";
import { PLATFORM_LABEL, type Product, type ReportSection } from "./types";

/** Gemini unless it is not configured or EVIDENCE_AI_MOCK=1 (deterministic tests). */
export const aiMocked = () => process.env.EVIDENCE_AI_MOCK === "1" || !env.hasGemini;

export async function codeRecordAI(input: {
  text: string;
  translation: string | null;
  entity: string;
  product: Product;
  themes: { key: string; label: string; description: string | null }[];
}): Promise<{ coding: EvidenceCoding; model: string }> {
  const keys = input.themes.map((t) => t.key);
  if (aiMocked()) return { coding: offlineCode({ text: input.translation ?? input.text, themeKeys: keys, product: input.product }), model: "offline-rules" };
  const { object } = await generateObject({
    model: models.flash(),
    schema: makeEvidenceCodingSchema(keys),
    system: EVIDENCE_CODE_SYSTEM,
    prompt: evidenceCodePrompt({ ...input }),
    temperature: 0,
    maxRetries: 2,
  });
  return { coding: object as EvidenceCoding, model: env.flashModel };
}

/** Plain-text matrix for the findings prompt: counts with denominators, percentages only where shown. */
export function matrixText(m: Matrix, themeLabels: Record<string, string>): string {
  const lines: string[] = [];
  for (const b of m.blocks) {
    lines.push(`[${b.groupName} · ${PLATFORM_LABEL[b.platform]} · ${b.family === "app" ? "app reviews" : "service experiences"}]`);
    for (const e of b.entities) {
      if (!e.n) continue;
      const cells = Object.entries(e.cells)
        .filter(([, c]) => c.count > 0)
        .map(([k, c]) => `${themeLabels[k] ?? k} ${c.count}${c.pct !== null ? ` (${c.pct}%)` : ""} [neg ${c.sentiment.negative}, pos ${c.sentiment.positive}, mixed ${c.sentiment.mixed}]`)
        .join("; ");
      lines.push(`  ${e.entityName}: n=${e.n}, threads=${e.threads}, contributors=${e.contributors}. ${cells}`);
    }
  }
  for (const s of m.switching) lines.push(`Switching — ${s.entityName}: ${s.records.length} records`);
  return lines.join("\n");
}

export async function draftFindingsAI(input: {
  question: string;
  section: ReportSection;
  matrix: Matrix;
  themeLabels: Record<string, string>;
  citable: { recordCode: string; entityId: string; entityName: string; themeKeys: string[]; text: string }[];
}): Promise<{ result: EvidenceFindings; by: "ai" | "human"; model: string }> {
  if (aiMocked() || input.citable.length === 0) {
    return { result: offlineFindings(input), by: "ai", model: "offline-rules" };
  }
  const { object } = await generateObject({
    model: models.flash(),
    schema: EvidenceFindingsSchema,
    system: EVIDENCE_FINDINGS_SYSTEM,
    prompt: evidenceFindingsPrompt({
      question: input.question,
      matrix: matrixText(input.matrix, input.themeLabels),
      records: input.citable.map((c) => `${c.recordCode} [${c.entityName}; ${c.themeKeys.join(", ")}]: ${c.text.slice(0, 300)}`).join("\n"),
    }),
    temperature: 0.2,
    maxRetries: 2,
  });
  return { result: object, by: "ai", model: env.flashModel };
}
