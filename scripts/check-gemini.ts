/**
 * Checks the Gemini setup used for report extraction, the pitch and the chatbot:
 * the key works, the configured models exist, structured output works and embeddings are 768-dim.
 *   npm run ai:check
 * Never prints the key.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const flash = process.env.GEMINI_FLASH_MODEL || "gemini-3.8-flash";
const pro = process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview";
const embedding = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => console.log(`  ✗ ${m}`);

async function main() {
  if (!key) {
    console.log("GOOGLE_GENERATIVE_AI_API_KEY is empty. Add it to .env.local (get one at https://aistudio.google.com/apikey).");
    process.exit(1);
  }
  let failed = false;

  console.log("1. Key and models");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } });
  if (!res.ok) {
    bad(`The key was rejected (HTTP ${res.status}). Check that it is copied correctly and the Generative Language API is enabled.`);
    process.exit(1);
  }
  ok("Key accepted");
  const { models = [] } = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const names = new Map(models.map((m) => [m.name.replace(/^models\//, ""), m.supportedGenerationMethods ?? []]));
  for (const [label, id, method] of [
    ["Extraction + chat (Flash)", flash, "generateContent"],
    ["Pitch (Pro)", pro, "generateContent"],
    ["Embeddings", embedding, "embedContent"],
  ] as const) {
    if (names.get(id)?.includes(method)) ok(`${label}: ${id}`);
    else {
      failed = true;
      const alternatives = [...names.entries()].filter(([, m]) => m.includes(method)).map(([n]) => n).filter((n) => /gemini/.test(n)).slice(0, 8);
      bad(`${label}: ${id} is not available to this key. Available: ${alternatives.join(", ") || "none"}`);
    }
  }

  const { google } = await import("@ai-sdk/google");
  const { embed, generateObject } = await import("ai");
  const { z } = await import("zod");

  console.log("2. Structured output (as used for report extraction)");
  try {
    const { object } = await generateObject({
      model: google(flash),
      schema: z.object({ revenue: z.number().nullable(), unitMultiplier: z.number() }),
      prompt: "From this statement extract revenue as printed and the unit multiplier: 'Revenue (LKR million): 30,940'.",
      temperature: 0,
    });
    if (object.revenue === 30940 && object.unitMultiplier === 1_000_000) ok(`Extracted revenue ${object.revenue} × ${object.unitMultiplier}`);
    else ok(`Responded (revenue ${object.revenue}, multiplier ${object.unitMultiplier})`);
  } catch (err) {
    failed = true;
    bad(`Structured output failed: ${(err as Error).message}`);
  }

  if (pro !== flash) {
    console.log("2b. Pitch model");
    try {
      const { generateText } = await import("ai");
      await generateText({ model: google(pro), prompt: "Reply with OK.", maxRetries: 0 });
      ok(`${pro} answered`);
    } catch (err) {
      failed = true;
      bad(`${pro} failed: ${(err as Error).message.slice(0, 160)} — on the free tier set GEMINI_PRO_MODEL=${flash}`);
    }
  }

  console.log("3. Embeddings (chatbot retrieval)");
  try {
    const { embedding: v } = await embed({
      model: google.textEmbedding(embedding),
      value: "Container throughput rose 14%",
      providerOptions: { google: { outputDimensionality: 768, taskType: "RETRIEVAL_QUERY" } },
    });
    if (v.length === 768) ok("768-dimension vectors, matching the database column");
    else {
      failed = true;
      bad(`Got ${v.length} dimensions; the database expects 768.`);
    }
  } catch (err) {
    failed = true;
    bad(`Embedding failed: ${(err as Error).message}`);
  }

  console.log(failed ? "\nSome checks failed — fix the items marked ✗ (model names can be changed in .env.local)." : "\nGemini is ready. Restart `npm run dev` so the server picks up the key.");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
