import "server-only";

/**
 * Feature switches derived from the environment. Each external service has a local fallback so the
 * app runs on a laptop with only a database: files go to .data/uploads, jobs run in-process,
 * the rate limit uses a database counter, and predictions use deterministic text without Gemini.
 */
export const env = {
  get hasGemini() {
    return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  },
  get hasBlob() {
    return !!process.env.BLOB_READ_WRITE_TOKEN;
  },
  /** Inngest runs when keys are set (production) or the dev server is enabled. */
  get hasInngest() {
    return !!process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV === "1";
  },
  get hasUpstash() {
    return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  },
  get flashModel() {
    return process.env.GEMINI_FLASH_MODEL || "gemini-3.8-flash";
  },
  get proModel() {
    return process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview";
  },
  get embeddingModel() {
    return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  },
};
