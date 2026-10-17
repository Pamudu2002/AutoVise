import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { modelVersion } from "@/lib/ai/gemini";
import { revalidateCompany } from "@/lib/cache";
import { db } from "@/lib/db";
import { auditLogs, companies, predictions } from "@/lib/db/schema";
import { buildHistory, valueCompany } from "@/lib/valuation";
import type { Step } from "@/lib/jobs/step";
import { directStep } from "@/lib/jobs/step";
import { pitchFacts } from "./facts";
import { scoreFactors } from "./factors";
import { basedOn, hashInputs, loadCompanyInputs } from "./inputs";
import { writePitch } from "./pitch";
import { publishPrediction } from "./publish";
import { buildSources } from "./sources";

export type RecomputeResult =
  | { status: "created"; predictionId: string; version: number; published: boolean }
  | { status: "unchanged"; predictionId: string }
  | { status: "insufficient"; reason: string }
  | { status: "missing" };

/**
 * Rebuilds a company's prediction from its current approved reports, price, sector, events and
 * settings. Skips the work when the inputs hash matches the latest prediction (unless forced).
 * New predictions are drafts unless auto-publish is on and the change is within its limits.
 */
export async function recomputeCompany(
  companyId: string,
  opts: { trigger?: string; force?: boolean; step?: Step; asOf?: Date } = {},
): Promise<RecomputeResult> {
  const step = opts.step ?? directStep;
  const asOf = opts.asOf ?? new Date();

  const prepared = await step("prepare", async () => {
    const inputs = await loadCompanyInputs(companyId, asOf);
    if (!inputs) return { kind: "missing" as const };
    const hash = hashInputs(inputs);
    const latest = await db.query.predictions.findFirst({
      where: and(eq(predictions.companyId, companyId), inArray(predictions.status, ["draft", "published"])),
      orderBy: desc(predictions.version),
    });
    if (!opts.force && latest && latest.inputsHash === hash) return { kind: "unchanged" as const, predictionId: latest.id };
    return { kind: "ready" as const, hash };
  });
  if (prepared.kind === "missing") return { status: "missing" };
  if (prepared.kind === "unchanged") return { status: "unchanged", predictionId: prepared.predictionId };

  // One step for the AI calls and the write, so retries never mix inputs from different moments.
  return step("value-and-write", async () => {
    const inputs = (await loadCompanyInputs(companyId, asOf))!;
    const hash = hashInputs(inputs);
    const { company, settings } = inputs;
    const { history, latestBalance, latestPeriodEnd } = buildHistory(inputs.metrics);
    const sources = buildSources(inputs);
    const factors = await scoreFactors(inputs, sources);

    const outcome = valueCompany({
      price: company.currentPrice ?? 0,
      priceDate: company.priceUpdatedAt ? company.priceUpdatedAt.toISOString().slice(0, 10) : null,
      history,
      latestBalance,
      latestPeriodEnd,
      sharesOutstanding: company.sharesOutstanding,
      sector: inputs.sector,
      factorScores: factors.scores,
      asOf,
      settings: settings.valuation,
    });
    if (!outcome.ok) {
      await db.insert(auditLogs).values({ actorEmail: "system", action: "prediction.skipped", entity: "company", entityId: companyId, after: { reason: outcome.reason, trigger: opts.trigger ?? null } });
      return { status: "insufficient" as const, reason: outcome.reason };
    }
    const result = outcome.result;

    const facts = pitchFacts({
      name: company.name,
      ticker: company.ticker,
      currency: company.currency,
      result,
      factorScores: factors.scores,
      history,
      scenarioShift: settings.valuation.scenario,
    });
    const sourcedInsights = inputs.insights
      .filter((i) => sources.byInsight.has(i.id))
      .map((i) => ({ sourceId: sources.byInsight.get(i.id)!, category: i.category, summary: i.summary, sentiment: i.sentiment, impact: i.impact }));
    const pitch = await writePitch(facts, sources, sourcedInsights);

    const last = await db.query.predictions.findFirst({ where: eq(predictions.companyId, companyId), orderBy: desc(predictions.version), columns: { version: true } });
    const published = await db.query.predictions.findFirst({ where: and(eq(predictions.companyId, companyId), eq(predictions.status, "published")) });

    const [row] = await db.transaction(async (tx) => {
      // Older drafts are superseded by this one but kept for history.
      await tx.update(predictions).set({ status: "archived" }).where(and(eq(predictions.companyId, companyId), eq(predictions.status, "draft")));
      return tx
        .insert(predictions)
        .values({
          companyId,
          version: (last?.version ?? 0) + 1,
          status: "draft",
          basePrice: result.assumptions.price,
          currency: company.currency,
          scenarios: result.scenarios,
          upsidePct: result.upsidePct,
          confidence: result.confidence,
          autoviseScore: result.autoviseScore,
          assumptions: result.assumptions,
          factorScores: factors.scores,
          valuationBreakdown: result.waterfall,
          pitch,
          citations: sources.citations,
          basedOn: basedOn(inputs.reports),
          inputsHash: hash,
          modelVersion: `${modelVersion()} · factors:${factors.by} · pitch:${pitch.generatedBy}`,
          trigger: opts.trigger ?? null,
        })
        .returning({ id: predictions.id, version: predictions.version });
    });

    const pub = settings.publishing;
    const change = published ? Math.abs(result.scenarios.base.y3 / published.scenarios.base.y3 - 1) : Infinity;
    const autoPublish =
      pub.autoPublish && result.confidence >= Math.max(pub.autoMinConfidence, pub.minConfidenceToPublish) && change <= pub.maxChange;
    if (autoPublish) await publishPrediction(row.id, null);

    await db.insert(auditLogs).values({
      actorEmail: "system",
      action: autoPublish ? "prediction.auto_published" : "prediction.drafted",
      entity: "prediction",
      entityId: row.id,
      after: { companyId, version: row.version, base: result.scenarios.base.y3, confidence: result.confidence, trigger: opts.trigger ?? null },
    });
    if (!autoPublish) {
      const c = await db.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { slug: true } });
      revalidateCompany(c?.slug);
    }
    return { status: "created" as const, predictionId: row.id, version: row.version, published: autoPublish };
  });
}
