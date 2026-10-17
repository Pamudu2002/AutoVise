import "server-only";
import { google } from "@ai-sdk/google";
import { env } from "@/lib/env";

/** Gemini models, server-side only. The key is read from GOOGLE_GENERATIVE_AI_API_KEY by the provider. */
export const models = {
  /** Extraction, qualitative scoring and chat. */
  flash: () => google(env.flashModel),
  /** Pitch narrative. */
  pro: () => google(env.proModel),
  embedding: () => google.textEmbedding(env.embeddingModel),
};

export const EMBEDDING_DIMENSIONS = 768;

export class AiUnavailableError extends Error {
  constructor() {
    super("Gemini is not configured (GOOGLE_GENERATIVE_AI_API_KEY is missing).");
  }
}

export function requireGemini() {
  if (!env.hasGemini) throw new AiUnavailableError();
}

export const modelVersion = () =>
  env.hasGemini ? `engine-1 · ${env.flashModel} · ${env.proModel}` : "engine-1 · deterministic";
