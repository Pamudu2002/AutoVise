import "server-only";
import { embed, embedMany } from "ai";
import { EMBEDDING_DIMENSIONS, models } from "@/lib/ai/gemini";
import { env } from "@/lib/env";

const options = (taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") => ({
  google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
});

/** Embeds report chunks (768 dims). Returns nulls when Gemini is not configured; full-text search still works. */
export async function embedDocuments(texts: string[]): Promise<(number[] | null)[]> {
  if (!env.hasGemini || texts.length === 0) return texts.map(() => null);
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 96) {
    const { embeddings } = await embedMany({
      model: models.embedding(),
      values: texts.slice(i, i + 96),
      providerOptions: options("RETRIEVAL_DOCUMENT"),
      maxRetries: 3,
    });
    out.push(...embeddings);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  if (!env.hasGemini) return null;
  try {
    const { embedding } = await embed({ model: models.embedding(), value: text, providerOptions: options("RETRIEVAL_QUERY") });
    return embedding;
  } catch {
    return null;
  }
}
