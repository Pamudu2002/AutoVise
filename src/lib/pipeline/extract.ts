import "server-only";
import { generateObject } from "ai";
import { models, requireGemini } from "@/lib/ai/gemini";
import { EXTRACT_SYSTEM, extractUserPrompt } from "@/lib/ai/prompts/extract";
import { extractionSchema, type Extraction } from "@/lib/ai/schemas";
import type { ParsedFile } from "./parse";

/**
 * Structured extraction with Gemini Flash. PDFs are sent as files so Gemini can read tables and
 * scanned pages natively; spreadsheets are sent as CSV text. Output is validated by Zod.
 */
export async function extractReport(input: {
  file: Buffer;
  mime: string;
  parsed: ParsedFile;
  companyName: string;
  ticker: string;
  reportTitle: string;
  fiscalPeriod: string;
}): Promise<Extraction> {
  requireGemini();
  const prompt = extractUserPrompt({ ...input, kind: input.parsed.kind });
  const content =
    input.parsed.kind === "pdf"
      ? [
          { type: "text" as const, text: prompt },
          { type: "file" as const, data: input.file, mediaType: "application/pdf" },
        ]
      : [
          {
            type: "text" as const,
            text: prompt + "\n\n" + input.parsed.pages.map((p) => `--- Sheet ${p.page} ---\n${p.text.slice(0, 60_000)}`).join("\n\n"),
          },
        ];

  const { object } = await generateObject({
    model: models.flash(),
    schema: extractionSchema,
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content }],
    temperature: 0,
    maxRetries: 2,
  });
  return sanitiseExtraction(object, input.parsed.pageCount);
}

/** Drops page references outside the document and clamps confidences. */
export function sanitiseExtraction(x: Extraction, pageCount: number): Extraction {
  const page = (p: number | null) => (p !== null && p >= 1 && p <= Math.max(pageCount, 1) ? p : null);
  return {
    ...x,
    periods: x.periods.map((p) => ({
      ...p,
      metrics: Object.fromEntries(
        Object.entries(p.metrics).map(([k, v]) => [k, { value: v.value, page: page(v.page), confidence: Math.max(0, Math.min(100, Math.round(v.confidence))) }]),
      ) as typeof p.metrics,
    })),
    insights: x.insights.map((i) => ({ ...i, page: page(i.page) })),
  };
}
