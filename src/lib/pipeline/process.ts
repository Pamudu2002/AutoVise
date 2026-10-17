import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { METRIC_FIELDS, type Extraction } from "@/lib/ai/schemas";
import { readFile } from "@/lib/blob";
import { db } from "@/lib/db";
import { companies, financialMetrics, financialReports, qualitativeInsights, reportChunks, reportVersions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { directStep, type Step } from "@/lib/jobs/step";
import { getSettings } from "@/lib/settings";
import { chunkPages } from "./chunk";
import { embedDocuments } from "./embed";
import { extractReport } from "./extract";
import { pageRanges, parseFile } from "./parse";

type VersionPatch = Partial<typeof reportVersions.$inferInsert>;

async function patchVersion(versionId: string, patch: VersionPatch) {
  await db.update(reportVersions).set(patch).where(eq(reportVersions.id, versionId));
}

async function loadContext(versionId: string) {
  const version = await db.query.reportVersions.findFirst({ where: eq(reportVersions.id, versionId) });
  if (!version) return null;
  const report = await db.query.financialReports.findFirst({ where: eq(financialReports.id, version.reportId) });
  if (!report) return null;
  const company = await db.query.companies.findFirst({ where: eq(companies.id, report.companyId) });
  if (!company) return null;
  // Jobs only write when their version is still the report's current one.
  const current = !report.deletedAt && report.currentVersionId === version.id && version.status !== "superseded";
  return { version, report, company, current };
}

export async function markVersionFailed(versionId: string, message: string) {
  await patchVersion(versionId, { status: "failed", error: message.slice(0, 500), progress: 0 });
}

export type ProcessResult = { skipped: true; reason: string } | { skipped: false; approved: boolean; companyId: string; title: string };

/**
 * process-report: parse the file, extract figures and insights with Gemini, chunk and embed the
 * text for the chatbot, then wait for review (or auto-approve when enabled in settings).
 */
export async function processReportVersion(versionId: string, step: Step = directStep): Promise<ProcessResult> {
  const start = await step("check-current", async () => {
    const c = await loadContext(versionId);
    if (!c?.current) return { ok: false as const };
    await patchVersion(versionId, { status: "processing", progress: 5, error: null });
    return { ok: true as const, companyId: c.company.id, title: c.report.title };
  });
  if (!start.ok) return { skipped: true, reason: "Version is no longer current." };

  const extracted = await step("extract", async () => {
    const c = await loadContext(versionId);
    if (!c?.current) return { ok: false as const };
    const file = await readFile(c.version.blobUrl);
    const parsed = await parseFile(file, c.version.mime);
    await patchVersion(versionId, {
      progress: 25,
      pageCount: parsed.pageCount,
      sha256: createHash("sha256").update(file).digest("hex"),
    });

    const notes: string[] = [];
    if (parsed.kind === "pdf" && parsed.emptyPages.length === parsed.pageCount && !env.hasGemini) {
      throw new Error("The PDF has no readable text (it looks scanned) and Gemini is not configured to read it.");
    }
    if (parsed.kind === "pdf" && parsed.emptyPages.length > 0) {
      notes.push(`Pages ${pageRanges(parsed.emptyPages)} have no text layer (scanned images); Gemini read them from the PDF itself.`);
    }

    let extraction: Extraction | null = null;
    if (env.hasGemini) {
      extraction = await extractReport({
        file,
        mime: c.version.mime,
        parsed,
        companyName: c.company.name,
        ticker: c.company.ticker,
        reportTitle: c.report.title,
        fiscalPeriod: c.report.fiscalPeriod,
      });
    } else {
      notes.push("Gemini is not configured, so figures were not extracted automatically. Add them by hand on this screen.");
    }

    // Re-check before writing: the file may have been replaced while Gemini was working.
    const again = await loadContext(versionId);
    if (!again?.current) return { ok: false as const };
    const counts = await writeExtraction(versionId, c.company.id, extraction);
    await patchVersion(versionId, { progress: 60 });
    return { ok: true as const, ...counts, note: notes.join(" ") || null };
  });
  if (!extracted.ok) return { skipped: true, reason: "Version was replaced during extraction." };

  await step("index", async () => {
    const c = await loadContext(versionId);
    if (!c?.current) return { chunks: 0 };
    const parsed = await parseFile(await readFile(c.version.blobUrl), c.version.mime);
    const chunks = chunkPages(parsed.pages);
    const embeddings = await embedDocuments(chunks.map((ch) => ch.content));
    await db.transaction(async (tx) => {
      await tx.delete(reportChunks).where(eq(reportChunks.reportVersionId, versionId));
      for (let i = 0; i < chunks.length; i += 100) {
        await tx.insert(reportChunks).values(
          chunks.slice(i, i + 100).map((ch, k) => ({
            reportVersionId: versionId,
            companyId: c.company.id,
            page: ch.page,
            chunkIndex: ch.index,
            content: ch.content,
            embedding: embeddings[i + k],
          })),
        );
      }
    });
    await patchVersion(versionId, { progress: 90 });
    return { chunks: chunks.length };
  });

  const final = await step("finalize", async () => {
    const c = await loadContext(versionId);
    if (!c?.current) return { ok: false as const };
    const settings = await getSettings();
    const approve = settings.extraction.autoApprove && extracted.metrics > 0;
    const now = new Date();
    await patchVersion(versionId, {
      status: approve ? "approved" : "review",
      progress: 100,
      processedAt: now,
      approvedAt: approve ? now : null,
      error: extracted.note,
    });
    if (approve) await db.update(financialMetrics).set({ verified: true }).where(eq(financialMetrics.reportVersionId, versionId));
    return { ok: true as const, approved: approve };
  });
  if (!final.ok) return { skipped: true, reason: "Version was replaced." };
  return { skipped: false, approved: final.approved, companyId: start.companyId, title: start.title };
}

/** Replaces this version's metrics and insights with a fresh extraction (idempotent for retries). */
export async function writeExtraction(versionId: string, companyId: string, x: Extraction | null) {
  let metrics = 0;
  let insights = 0;
  await db.transaction(async (tx) => {
    await tx.delete(financialMetrics).where(eq(financialMetrics.reportVersionId, versionId));
    await tx.delete(qualitativeInsights).where(eq(qualitativeInsights.reportVersionId, versionId));
    if (!x) return;
    for (const p of x.periods) {
      const values: Record<string, number | null> = {};
      const pages: Record<string, number> = {};
      const confidence: Record<string, number> = {};
      let any = false;
      for (const f of METRIC_FIELDS) {
        const m = p.metrics[f];
        values[f] = m.value;
        if (m.value !== null) any = true;
        if (m.page !== null) pages[f] = m.page;
        confidence[f] = m.confidence;
      }
      if (!any) continue;
      await tx.insert(financialMetrics).values({
        reportVersionId: versionId,
        companyId,
        fiscalYear: p.fiscalYear,
        period: p.period,
        unitMultiplier: x.unitMultiplier,
        ...values,
        sourcePages: pages,
        extra: { confidence },
      });
      metrics += Object.values(values).filter((v) => v !== null).length;
    }
    if (x.insights.length) {
      await tx.insert(qualitativeInsights).values(
        x.insights.map((i) => ({
          reportVersionId: versionId,
          companyId,
          category: i.category,
          summary: i.summary,
          sentiment: i.sentiment,
          impact: i.impact,
          evidenceQuote: i.evidenceQuote,
          page: i.page,
        })),
      );
      insights = x.insights.length;
    }
  });
  return { metrics, insights };
}

