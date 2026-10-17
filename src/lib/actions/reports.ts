"use server";

import { and, desc, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin";
import { METRIC_FIELDS } from "@/lib/ai/schemas";
import { deleteFile } from "@/lib/blob";
import { revalidateCompany } from "@/lib/cache";
import { db } from "@/lib/db";
import { companies, financialMetrics, financialReports, qualitativeInsights, reportChunks, reportVersions } from "@/lib/db/schema";
import { sendRecompute, sendReportUploaded } from "@/lib/jobs";
import { REPORT_MAX_BYTES, REPORT_TYPES } from "@/lib/reports/files";
import { run, UserError, type ActionResult } from "./result";

const meta = z.object({
  title: z.string().trim().min(3, "Give the report a title.").max(120),
  type: z.enum(["annual", "quarterly", "interim", "other"]),
  fiscalYear: z.coerce.number().int().min(1990).max(2100),
  fiscalPeriod: z.string().trim().min(2).max(40),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

const upload = meta.extend({
  companyId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
  url: z.string().min(1).max(2000),
  pathname: z.string().min(1).max(500),
  fileName: z.string().min(1).max(200),
  mime: z.enum(REPORT_TYPES),
  size: z.number().int().positive().max(REPORT_MAX_BYTES),
  note: z.string().max(300).optional(),
});

function refresh(companyTicker?: string | null) {
  revalidatePath("/admin", "layout");
  if (companyTicker) revalidatePath(`/admin/companies/${companyTicker.toLowerCase()}/reports`);
}

/**
 * Called after a file finished uploading to Blob. Creates the report (or a new version of an existing
 * one), marks the previous version superseded, and starts processing. Every upload or replacement
 * also queues a recompute, which is debounced per company.
 */
export async function registerReportUpload(input: z.input<typeof upload>): Promise<ActionResult<{ reportId: string; versionId: string; versionNo: number }>> {
  return run(async () => {
    const admin = await requireAdmin("reports.write");
    const d = upload.parse(input);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, d.companyId) });
    if (!company) throw new UserError("Company not found.");

    const result = await db.transaction(async (tx) => {
      let reportId = d.reportId;
      let previous: string | null = null;
      if (reportId) {
        const rep = await tx.query.financialReports.findFirst({ where: and(eq(financialReports.id, reportId), eq(financialReports.companyId, company.id)) });
        if (!rep || rep.deletedAt) throw new UserError("That report no longer exists.");
        previous = rep.currentVersionId;
      } else {
        const [rep] = await tx
          .insert(financialReports)
          .values({ companyId: company.id, title: d.title, type: d.type, fiscalYear: d.fiscalYear, fiscalPeriod: d.fiscalPeriod, periodEnd: d.periodEnd ?? null })
          .returning({ id: financialReports.id });
        reportId = rep.id;
      }
      const [{ n }] = await tx.select({ n: max(reportVersions.versionNo) }).from(reportVersions).where(eq(reportVersions.reportId, reportId));
      const [ver] = await tx
        .insert(reportVersions)
        .values({ reportId, versionNo: (n ?? 0) + 1, blobUrl: d.url, fileName: d.fileName, mime: d.mime, size: d.size, status: "uploaded", uploadedBy: admin.id, note: d.note ?? null })
        .returning();
      if (previous) await tx.update(reportVersions).set({ status: "superseded" }).where(eq(reportVersions.id, previous));
      await tx.update(financialReports).set({ currentVersionId: ver.id, updatedAt: new Date() }).where(eq(financialReports.id, reportId));
      return { reportId, versionId: ver.id, versionNo: ver.versionNo, replaced: !!previous };
    });

    await audit(admin, result.replaced ? "report.replaced" : "report.uploaded", "report", result.reportId, null, { versionNo: result.versionNo, fileName: d.fileName });
    await sendReportUploaded(result.versionId, company.id);
    await sendRecompute(company.id, `${d.title} ${result.replaced ? `replaced (v${result.versionNo})` : "uploaded"}`);
    refresh(company.ticker);
    revalidateCompany(company.slug);
    return { reportId: result.reportId, versionId: result.versionId, versionNo: result.versionNo };
  });
}

export async function updateReportMeta(reportId: string, input: z.input<typeof meta>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("reports.write");
    const d = meta.parse(input);
    const before = await db.query.financialReports.findFirst({ where: eq(financialReports.id, reportId) });
    if (!before) throw new UserError("Report not found.");
    await db.update(financialReports).set({ ...d, periodEnd: d.periodEnd ?? null, updatedAt: new Date() }).where(eq(financialReports.id, reportId));
    await audit(admin, "report.updated", "report", reportId, before, d);
    refresh();
  }, "Report details saved.");
}

/**
 * Deletes a report: it drops out of every query (soft delete), its extracted data and chunks are
 * removed, its files are deleted, and the company is recomputed without it.
 */
export async function deleteReport(reportId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("reports.write");
    const rep = await db.query.financialReports.findFirst({ where: eq(financialReports.id, reportId) });
    if (!rep || rep.deletedAt) throw new UserError("Report not found.");
    const versions = await db.select().from(reportVersions).where(eq(reportVersions.reportId, reportId));
    const ids = versions.map((v) => v.id);
    await db.transaction(async (tx) => {
      await tx.update(financialReports).set({ deletedAt: new Date() }).where(eq(financialReports.id, reportId));
      if (ids.length) {
        await tx.delete(financialMetrics).where(inArray(financialMetrics.reportVersionId, ids));
        await tx.delete(qualitativeInsights).where(inArray(qualitativeInsights.reportVersionId, ids));
        await tx.delete(reportChunks).where(inArray(reportChunks.reportVersionId, ids));
      }
    });
    for (const v of versions) await deleteFile(v.blobUrl).catch(() => {});
    const company = await db.query.companies.findFirst({ where: eq(companies.id, rep.companyId) });
    await audit(admin, "report.deleted", "report", reportId, { title: rep.title, versions: versions.length }, null);
    await sendRecompute(rep.companyId, `${rep.title} deleted`);
    refresh(company?.ticker);
    revalidateCompany(company?.slug);
  }, "Report deleted. The prediction is queued for recalculation.");
}

/** Re-extract (or retry a failed run): the version goes back through process-report. */
export async function reprocessVersion(versionId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("reports.write");
    const v = await db.query.reportVersions.findFirst({ where: eq(reportVersions.id, versionId) });
    if (!v) throw new UserError("Version not found.");
    if (v.status === "superseded") throw new UserError("Superseded versions cannot be processed again.");
    const rep = await db.query.financialReports.findFirst({ where: eq(financialReports.id, v.reportId) });
    if (!rep || rep.deletedAt) throw new UserError("Report not found.");
    await db.update(reportVersions).set({ status: "uploaded", progress: 0, error: null, approvedAt: null, approvedBy: null }).where(eq(reportVersions.id, versionId));
    await audit(admin, v.status === "failed" ? "report.retried" : "report.reextracted", "report_version", versionId);
    await sendReportUploaded(versionId, rep.companyId);
    refresh();
  }, "Processing started.");
}

/** Approves the extracted data; the company is then recomputed with it. */
export async function approveVersion(versionId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("reports.review");
    const v = await db.query.reportVersions.findFirst({ where: eq(reportVersions.id, versionId) });
    if (!v) throw new UserError("Version not found.");
    if (v.status !== "review") throw new UserError("Only versions waiting for review can be approved.");
    const rep = await db.query.financialReports.findFirst({ where: eq(financialReports.id, v.reportId) });
    if (!rep || rep.deletedAt || rep.currentVersionId !== v.id) throw new UserError("This version is no longer current.");
    await db.update(reportVersions).set({ status: "approved", approvedAt: new Date(), approvedBy: admin.id }).where(eq(reportVersions.id, versionId));
    await db.update(financialMetrics).set({ verified: true }).where(eq(financialMetrics.reportVersionId, versionId));
    await audit(admin, "report.approved", "report_version", versionId, null, { title: rep.title, versionNo: v.versionNo });
    await sendRecompute(rep.companyId, `${rep.title} approved`);
    refresh();
  }, "Report approved. A new prediction draft is being prepared.");
}

const metricValue = z.union([z.number().finite(), z.null()]);

/** Inline edit of one extracted figure; the original value is kept for the audit trail. */
export async function updateMetric(metricId: string, field: (typeof METRIC_FIELDS)[number], value: number | null): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("reports.review");
    if (!METRIC_FIELDS.includes(field)) throw new UserError("Unknown field.");
    const v = metricValue.parse(value);
    const row = await db.query.financialMetrics.findFirst({ where: eq(financialMetrics.id, metricId) });
    if (!row) throw new UserError("Metric not found.");
    const old = row[field] as number | null;
    const edits = { ...(row.edits ?? {}) };
    if (!(field in edits)) edits[field] = old;
    if (edits[field] === v) delete edits[field];
    await db.update(financialMetrics).set({ [field]: v, edits, editedBy: admin.id }).where(eq(financialMetrics.id, metricId));
    await audit(admin, "metric.edited", "financial_metric", metricId, { [field]: old }, { [field]: v });
    await recomputeIfApproved(row.reportVersionId, "Figures edited");
    refresh();
  }, "Figure saved.");
}

const periodRow = z.object({
  fiscalYear: z.coerce.number().int().min(1990).max(2100),
  period: z.enum(["FY", "H1", "Q1", "Q2", "Q3", "Q4", "9M"]),
  unitMultiplier: z.coerce.number().positive(),
});

/** Adds an empty period so figures can be entered by hand (e.g. when Gemini is not configured). */
export async function addMetricPeriod(versionId: string, input: z.input<typeof periodRow>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("reports.review");
    const d = periodRow.parse(input);
    const v = await db.query.reportVersions.findFirst({ where: eq(reportVersions.id, versionId) });
    if (!v) throw new UserError("Version not found.");
    const rep = await db.query.financialReports.findFirst({ where: eq(financialReports.id, v.reportId) });
    if (!rep) throw new UserError("Report not found.");
    const exists = await db.query.financialMetrics.findFirst({
      where: and(eq(financialMetrics.reportVersionId, versionId), eq(financialMetrics.fiscalYear, d.fiscalYear), eq(financialMetrics.period, d.period)),
    });
    if (exists) throw new UserError(`${d.period} ${d.fiscalYear} is already listed.`);
    await db.insert(financialMetrics).values({ reportVersionId: versionId, companyId: rep.companyId, ...d, sourcePages: {}, extra: { confidence: {} }, editedBy: admin.id });
    await audit(admin, "metric.period_added", "report_version", versionId, null, d);
    refresh();
  });
}

export async function setInsightIncluded(insightId: string, included: boolean): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("reports.review");
    const row = await db.query.qualitativeInsights.findFirst({ where: eq(qualitativeInsights.id, insightId) });
    if (!row) throw new UserError("Insight not found.");
    await db.update(qualitativeInsights).set({ included }).where(eq(qualitativeInsights.id, insightId));
    await audit(admin, included ? "insight.included" : "insight.excluded", "qualitative_insight", insightId);
    await recomputeIfApproved(row.reportVersionId, "Insights changed");
    refresh();
  });
}

async function recomputeIfApproved(versionId: string, trigger: string) {
  const v = await db.query.reportVersions.findFirst({ where: eq(reportVersions.id, versionId) });
  if (v?.status !== "approved") return;
  const rep = await db.query.financialReports.findFirst({ where: eq(financialReports.id, v.reportId) });
  if (rep && !rep.deletedAt && rep.currentVersionId === v.id) await sendRecompute(rep.companyId, `${trigger} on ${rep.title}`);
}

/** Version history for the replace dialog. */
export async function versionHistory(reportId: string) {
  await requireAdmin();
  return db.select().from(reportVersions).where(eq(reportVersions.reportId, reportId)).orderBy(desc(reportVersions.versionNo));
}
