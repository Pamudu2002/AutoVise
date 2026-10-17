import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { ChatInsights, type ConversationMsg, type DownVoted, type TopQuestion } from "@/components/admin/chat-insights";
import { requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { chatMessages, companies } from "@/lib/db/schema";

export const metadata = { title: "Chat Insights" };
export const dynamic = "force-dynamic";

const RANGES = { d1: 1, d7: 7, d30: 30 } as const;
const norm = (q: string) =>
  q
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default async function ChatInsightsPage({ searchParams }: { searchParams: Promise<{ co?: string; range?: string }> }) {
  await requirePageAdmin("chat.review");
  const sp = await searchParams;
  const range = (sp.range && sp.range in RANGES ? sp.range : "d7") as keyof typeof RANGES;
  const since = range === "d1" ? new Date(new Date().setUTCHours(0, 0, 0, 0)) : new Date(Date.now() - RANGES[range] * 86_400_000);
  const cos = await db.select({ id: companies.id, ticker: companies.ticker, name: companies.name, slug: companies.slug }).from(companies).orderBy(asc(companies.name));
  const co = cos.find((c) => c.slug === sp.co);

  const conds = [gte(chatMessages.createdAt, since)];
  if (co) conds.push(eq(chatMessages.companyId, co.id));
  const msgs = await db.select().from(chatMessages).where(and(...conds)).orderBy(asc(chatMessages.createdAt));
  const ticker = new Map(cos.map((c) => [c.id, c.ticker]));

  // Pair each question with the answer that followed it in the same session.
  const bySession = new Map<string, typeof msgs>();
  for (const m of msgs) bySession.set(m.sessionId, [...(bySession.get(m.sessionId) ?? []), m]);
  const pairs: { q: (typeof msgs)[number]; a: (typeof msgs)[number] | null }[] = [];
  for (const list of bySession.values()) {
    list.forEach((m, i) => {
      if (m.role === "user") pairs.push({ q: m, a: list.slice(i + 1).find((x) => x.role === "assistant") ?? null });
    });
  }

  const groups = new Map<string, { text: string; companies: Set<string>; n: number; up: number; rated: number }>();
  for (const { q, a } of pairs) {
    const key = norm(q.content);
    const g = groups.get(key) ?? { text: q.content, companies: new Set<string>(), n: 0, up: 0, rated: 0 };
    g.n++;
    g.companies.add(ticker.get(q.companyId) ?? "?");
    if (a?.feedback === 1 || a?.feedback === -1) {
      g.rated++;
      if (a.feedback === 1) g.up++;
    }
    groups.set(key, g);
  }
  const top: TopQuestion[] = [...groups.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 10)
    .map((g) => ({ q: g.text, n: g.n, co: [...g.companies].join(", "), helpful: g.rated ? g.up / g.rated : null }));

  const answers = msgs.filter((m) => m.role === "assistant");
  const rated = answers.filter((m) => m.feedback === 1 || m.feedback === -1);
  const down: DownVoted[] = pairs
    .filter((p) => p.a?.feedback === -1)
    .map((p) => ({
      id: p.a!.id,
      sessionId: p.a!.sessionId,
      co: ticker.get(p.a!.companyId) ?? "?",
      q: p.q.content,
      a: p.a!.content,
      reason: p.a!.feedbackReason,
      note: p.a!.feedbackNote,
      at: p.a!.createdAt.toISOString(),
      reviewed: !!p.a!.reviewedAt,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));

  const sessions = [...new Set(down.map((d) => d.sessionId))];
  const convo: ConversationMsg[] = sessions.length
    ? (await db.select().from(chatMessages).where(inArray(chatMessages.sessionId, sessions)).orderBy(asc(chatMessages.createdAt))).map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        at: m.createdAt.toISOString(),
        feedback: m.feedback,
      }))
    : [];

  return (
    <ChatInsights
      companies={cos}
      co={co?.slug ?? "all"}
      range={range}
      kpi={{ questions: pairs.length, helpful: rated.length ? rated.filter((m) => m.feedback === 1).length / rated.length : null, open: down.filter((d) => !d.reviewed).length }}
      top={top}
      down={down}
      conversations={convo}
    />
  );
}
