import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReviewScreen } from "@/components/admin/review-screen";
import { can, requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { companies, financialMetrics, financialReports, qualitativeInsights, reportChunks, reportVersions } from "@/lib/db/schema";
import { isExcel } from "@/lib/reports/files";

export const metadata = { title: "Report review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const v = await db.query.reportVersions.findFirst({ where: eq(reportVersions.id, id) });
  if (!v) notFound();
  const r = await db.query.financialReports.findFirst({ where: eq(financialReports.id, v.reportId) });
  if (!r) notFound();
  const c = await db.query.companies.findFirst({ where: eq(companies.id, r.companyId) });
  if (!c) notFound();
  const [metrics, insights, sheets] = await Promise.all([
    db.select().from(financialMetrics).where(eq(financialMetrics.reportVersionId, id)).orderBy(asc(financialMetrics.fiscalYear)),
    db.select().from(qualitativeInsights).where(eq(qualitativeInsights.reportVersionId, id)).orderBy(asc(qualitativeInsights.page)),
    isExcel(v.mime) ? db.select({ page: reportChunks.page, content: reportChunks.content }).from(reportChunks).where(eq(reportChunks.reportVersionId, id)).orderBy(asc(reportChunks.chunkIndex)) : [],
  ]);

  return (
    <ReviewScreen
      version={{
        id: v.id,
        versionNo: v.versionNo,
        status: v.status,
        fileName: v.fileName,
        url: v.blobUrl,
        isPdf: v.mime === "application/pdf",
        pageCount: v.pageCount,
        error: v.error,
        current: r.currentVersionId === v.id && !r.deletedAt,
      }}
      report={{ id: r.id, title: r.title, type: r.type, fiscalPeriod: r.fiscalPeriod }}
      company={{ name: c.name, ticker: c.ticker, slug: c.slug, currency: c.currency }}
      metrics={metrics.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      insights={insights.map((i) => ({ id: i.id, category: i.category, summary: i.summary, sentiment: i.sentiment, impact: i.impact, quote: i.evidenceQuote, page: i.page, included: i.included }))}
      sheets={sheets}
      canReview={can(user.role, "reports.review")}
      canWrite={can(user.role, "reports.write")}
    />
  );
}
