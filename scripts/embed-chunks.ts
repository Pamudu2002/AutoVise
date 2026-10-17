/**
 * Embeds report chunks that were stored without a vector (for example before Gemini was configured),
 * so the chatbot's semantic search covers them.
 *   npm run ai:embed
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.log("GOOGLE_GENERATIVE_AI_API_KEY is empty; nothing to do.");
    process.exit(1);
  }
  const { eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { reportChunks } = await import("@/lib/db/schema");
  const { embedDocuments } = await import("@/lib/pipeline/embed");

  let done = 0;
  for (;;) {
    const batch = await db.select({ id: reportChunks.id, content: reportChunks.content }).from(reportChunks).where(isNull(reportChunks.embedding)).limit(96);
    if (!batch.length) break;
    const vectors = await embedDocuments(batch.map((c) => c.content));
    for (const [i, c] of batch.entries()) {
      await db.update(reportChunks).set({ embedding: vectors[i] }).where(eq(reportChunks.id, c.id));
    }
    done += batch.length;
    console.log(`  embedded ${done} chunks`);
  }
  console.log(done ? `Done: ${done} chunks embedded.` : "Every chunk already has an embedding.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
