import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { models } from "@/lib/ai/gemini";
import { chatSystemPrompt } from "@/lib/ai/prompts/chat";
import { chatRequestSchema, METRIC_FIELDS } from "@/lib/ai/schemas";
import { getCompanyPage } from "@/lib/data/public";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { ANON_COOKIE, type ChatMeta } from "@/lib/chat";
import { buildChatContext, citedIds, type ChatCitation } from "@/lib/rag/context";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { checkLimits, clientIp } from "@/lib/ratelimit";
import { getSettings } from "@/lib/settings";
import { runScenario } from "@/lib/valuation/scenarios";

export const maxDuration = 60;

function textOf(m: { parts: { type: string; text?: unknown }[] }): string {
  return m.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .slice(0, 2000);
}

const json = (status: number, error: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json", ...headers } });

export async function POST(req: Request) {
  if (!env.hasGemini) return json(503, "The consultant is offline right now (Gemini is not configured).");

  const parsed = chatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, "Invalid chat request.");
  const { slug } = parsed.data;
  const messages = parsed.data.messages.slice(-12) as unknown as UIMessage[];
  const last = messages[messages.length - 1];
  const question = last?.role === "user" ? textOf(last as never) : "";
  if (!question.trim()) return json(400, "Ask a question.");

  const data = await getCompanyPage(slug);
  if (!data || data.company.status !== "published") return json(404, "Company not found.");

  const jar = await cookies();
  let anonId = jar.get(ANON_COOKIE)?.value;
  if (!anonId || !/^[\w-]{10,64}$/.test(anonId)) {
    anonId = randomUUID();
    jar.set(ANON_COOKIE, anonId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180, path: "/" });
  }

  const settings = await getSettings();
  const limit = await checkLimits([
    { key: `ip:${clientIp(req)}`, limit: settings.chat.perIpPerHour },
    { key: `session:${anonId}`, limit: settings.chat.perSessionPerHour },
  ]);
  if (!limit.ok) {
    return json(429, `You've asked a lot of questions in a short time. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const companyId = data.company.id;
  const [session] = await db
    .insert(chatSessions)
    .values({ anonId, companyId })
    .onConflictDoUpdate({ target: [chatSessions.anonId, chatSessions.companyId], set: { lastActiveAt: sql`now()` } })
    .returning({ id: chatSessions.id });
  await db.insert(chatMessages).values({ sessionId: session.id, companyId, role: "user", content: question });

  const retrieved = await retrieveChunks(companyId, question, 8);
  const { context, citations } = buildChatContext(data, retrieved);
  const registry = new Map(citations.map((c) => [c.id, c]));
  let extraIndex = retrieved.length + 1;
  const assistantId = randomUUID();
  let answer = "";

  const history = data.history;
  const prediction = data.prediction;
  const fieldEnum = z.enum(METRIC_FIELDS);

  const result = streamText({
    model: models.flash(),
    system: chatSystemPrompt({ companyName: data.company.name, ticker: data.company.ticker, context, disclaimer: settings.disclaimer.short }),
    messages: convertToModelMessages(messages),
    temperature: 0.2,
    stopWhen: stepCountIs(4),
    tools: {
      getMetric: tool({
        description: "Get one reported annual figure (in currency units; EPS and DPS per share).",
        inputSchema: z.object({ year: z.number().int(), field: fieldEnum }),
        execute: async ({ year, field }) => {
          const row = history.find((h) => h.year === year);
          const value = row ? (row as unknown as Record<string, number | null>)[field] : null;
          return value === null || value === undefined
            ? { found: false, note: `No ${field} reported for FY${year}.`, availableYears: history.map((h) => h.year) }
            : { found: true, year, field, value, currency: data.company.currency };
        },
      }),
      compareYears: tool({
        description: "Compare a reported annual figure between two years, with the percent change.",
        inputSchema: z.object({ field: fieldEnum, fromYear: z.number().int(), toYear: z.number().int() }),
        execute: async ({ field, fromYear, toYear }) => {
          const get = (y: number) => (history.find((h) => h.year === y) as unknown as Record<string, number | null> | undefined)?.[field] ?? null;
          const a = get(fromYear);
          const b = get(toYear);
          return { field, fromYear, toYear, from: a, to: b, changePct: a && b ? Math.round((b / a - 1) * 1000) / 10 : null };
        },
      }),
      runScenario: tool({
        description:
          "Rerun the AutoVise projection with different levers, using the same engine as the published prediction. growthPct is starting EPS growth in percent; exitPe is the exit P/E before the qualitative overlay; tilt is the qualitative composite from −1 to 1 (omit to keep the published one).",
        inputSchema: z.object({ growthPct: z.number().min(-20).max(40), exitPe: z.number().min(2).max(60), tilt: z.number().min(-1).max(1).optional() }),
        execute: async ({ growthPct, exitPe, tilt }) => {
          if (!prediction) return { error: "There is no published prediction to rerun." };
          const a = prediction.assumptions;
          const run = runScenario(a.model, { growth: growthPct / 100, exitPe, tilt: tilt ?? a.baseLevers.tilt });
          const target = run.rows[run.rows.length - 1].price;
          return {
            years: run.rows.map((r) => ({ year: r.year, eps: Math.round(r.eps * 100) / 100, pe: Math.round(r.pe * 10) / 10, price: Math.round(r.price * 100) / 100 })),
            target: Math.round(target * 100) / 100,
            publishedBaseTarget: Math.round(prediction.scenarios.base.y3 * 100) / 100,
            upsidePct: Math.round((target / a.price - 1) * 1000) / 10,
            note: "Limits from settings (growth and P/E caps, qualitative cap) still apply.",
          };
        },
      }),
      searchReports: tool({
        description: "Search this company's approved reports for passages about a topic. Cite results by their id.",
        inputSchema: z.object({ query: z.string().min(3).max(200) }),
        execute: async ({ query }) => {
          const found = await retrieveChunks(companyId, query, 5);
          return found.map((r) => {
            const id = `R${extraIndex++}`;
            const label = `${r.title.replace(/ Report$/, "")}${r.page ? `, p.${r.page}` : ""}`;
            registry.set(id, { id, label, page: r.page, quote: r.content.slice(0, 400), url: data.reports.find((x) => x.versionId === r.reportVersionId)?.url ?? null });
            return { id, source: label, text: r.content.slice(0, 1200) };
          });
        },
      }),
    },
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") answer += chunk.text;
    },
    onFinish: async ({ text }) => {
      const final = text || answer;
      const used = citedIds(final).map((id) => registry.get(id)).filter((c): c is ChatCitation => !!c);
      await db.insert(chatMessages).values({
        id: assistantId,
        sessionId: session.id,
        companyId,
        role: "assistant",
        content: final || "(no answer)",
        citations: used.map((c) => ({ id: c.id, label: c.label, page: c.page, quote: c.quote, reportId: null, reportVersionId: null, versionNo: null })),
      });
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }): ChatMeta | undefined => {
      if (part.type === "start") return { dbId: assistantId };
      if (part.type === "finish") {
        const used = citedIds(answer).map((id) => registry.get(id)).filter((c): c is ChatCitation => !!c);
        return { dbId: assistantId, citations: used };
      }
      return undefined;
    },
    onError: (err) => {
      console.error("[chat]", err);
      return "The consultant could not answer just now. Please try again.";
    },
  });
}

/** Thumbs up/down with an optional reason. Only the visitor who received the answer can rate it. */
export async function PUT(req: Request) {
  const { feedbackSchema } = await import("@/lib/ai/schemas");
  const parsed = feedbackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, "Invalid feedback.");
  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  if (!anonId) return json(403, "No chat session.");
  const msg = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatSessions.id, chatMessages.sessionId))
    .where(and(eq(chatMessages.id, parsed.data.messageId), eq(chatSessions.anonId, anonId), eq(chatMessages.role, "assistant")))
    .limit(1);
  if (!msg[0]) return json(404, "Message not found.");
  const { vote, reason, note } = parsed.data;
  await db
    .update(chatMessages)
    .set({ feedback: vote, feedbackReason: vote === -1 ? (reason ?? null) : null, feedbackNote: vote === -1 ? (note ?? null) : null, reviewedAt: null })
    .where(eq(chatMessages.id, parsed.data.messageId));
  return new Response(null, { status: 204 });
}
