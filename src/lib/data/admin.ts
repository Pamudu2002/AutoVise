import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { admins, chatMessages, companies, financialMetrics, financialReports, predictions, reportVersions, sectors } from "@/lib/db/schema";

/** Weekdays between two dates (a simple stand-in for exchange trading days). */
export function tradingDaysBetween(from: Date, to: Date): number {
  let n = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (d.getTime() < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export interface QueueItem {
  versionId: string;
  reportId: string;
  companyId: string;
  companyName: string;
  ticker: string;
  title: string;
  type: string;
  fiscalPeriod: string;
  fileName: string;
  versionNo: number;
  status: (typeof reportVersions.$inferSelect)["status"];
  progress: number;
  error: string | null;
  createdAt: Date;
  current: boolean;
}

/** Report versions for the processing queue, newest first. */
export async function reportQueue(opts: { sinceDays?: number; companyId?: string; limit?: number } = {}): Promise<QueueItem[]> {
  const conds = [isNull(financialReports.deletedAt)];
  if (opts.sinceDays) conds.push(gte(reportVersions.createdAt, new Date(Date.now() - opts.sinceDays * 86_400_000)));
  if (opts.companyId) conds.push(eq(financialReports.companyId, opts.companyId));
  const rows = await db
    .select({ v: reportVersions, r: financialReports, c: { id: companies.id, name: companies.name, ticker: companies.ticker } })
    .from(reportVersions)
    .innerJoin(financialReports, eq(financialReports.id, reportVersions.reportId))
    .innerJoin(companies, eq(companies.id, financialReports.companyId))
    .where(and(...conds))
    .orderBy(desc(reportVersions.createdAt))
    .limit(opts.limit ?? 50);
  return rows.map(({ v, r, c }) => ({
    versionId: v.id,
    reportId: r.id,
    companyId: c.id,
    companyName: c.name,
    ticker: c.ticker,
    title: r.title,
    type: r.type,
    fiscalPeriod: r.fiscalPeriod,
    fileName: v.fileName,
    versionNo: v.versionNo,
    status: v.status,
    progress: v.progress,
    error: v.error,
    createdAt: v.createdAt,
    current: r.currentVersionId === v.id,
  }));
}

export async function dashboardStats(stalePriceDays: number) {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [byStatus, current, drafts, chatsToday, downToday, cos] = await Promise.all([
    db.select({ status: companies.status, n: count() }).from(companies).groupBy(companies.status),
    db
      .select({ status: reportVersions.status, n: count() })
      .from(financialReports)
      .innerJoin(reportVersions, eq(reportVersions.id, financialReports.currentVersionId))
      .where(isNull(financialReports.deletedAt))
      .groupBy(reportVersions.status),
    db
      .select({ p: predictions, ticker: companies.ticker, name: companies.name })
      .from(predictions)
      .innerJoin(companies, eq(companies.id, predictions.companyId))
      .where(eq(predictions.status, "draft"))
      .orderBy(asc(predictions.createdAt)),
    db.select({ n: count() }).from(chatMessages).where(and(eq(chatMessages.role, "user"), gte(chatMessages.createdAt, startOfDay))),
    db.select({ n: count() }).from(chatMessages).where(and(eq(chatMessages.feedback, -1), gte(chatMessages.createdAt, startOfDay))),
    db
      .select({ id: companies.id, name: companies.name, ticker: companies.ticker, brandColor: companies.brandColor, logoUrl: companies.logoUrl, logoDarkUrl: companies.logoDarkUrl, logoBg: companies.logoBg, logoShape: companies.logoShape, slug: companies.slug, priceUpdatedAt: companies.priceUpdatedAt, currentPrice: companies.currentPrice, currency: companies.currency })
      .from(companies),
  ]);
  const published = drafts.length
    ? await db
        .select({ companyId: predictions.companyId, base: sql<number>`(${predictions.scenarios}->'base'->>'y3')::float` })
        .from(predictions)
        .where(and(eq(predictions.status, "published"), inArray(predictions.companyId, drafts.map((d) => d.p.companyId))))
    : [];

  const stale = cos
    .map((c) => ({ ...c, days: c.priceUpdatedAt ? tradingDaysBetween(c.priceUpdatedAt, now) : Infinity }))
    .filter((c) => c.days > stalePriceDays)
    .sort((a, b) => b.days - a.days);
  const status = (s: string) => current.find((x) => x.status === s)?.n ?? 0;

  return {
    companies: { published: byStatus.find((x) => x.status === "published")?.n ?? 0, draft: byStatus.find((x) => x.status === "draft")?.n ?? 0 },
    processing: status("processing") + status("uploaded"),
    review: status("review"),
    failed: status("failed"),
    drafts: drafts.map((d) => ({ ...d, oldBase: published.find((x) => x.companyId === d.p.companyId)?.base ?? null })),
    chatsToday: chatsToday[0]?.n ?? 0,
    downToday: downToday[0]?.n ?? 0,
    stale,
  };
}

export async function sectorOptions() {
  return db.select({ id: sectors.id, name: sectors.name }).from(sectors).orderBy(asc(sectors.name));
}

export async function adminName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const a = await db.query.admins.findFirst({ where: eq(admins.id, id), columns: { name: true } });
  return a?.name ?? null;
}

/** Reports (not deleted) with their current version, version history and extracted-figure count. */
export async function reportRows(opts: { companyId?: string } = {}) {
  const conds = [isNull(financialReports.deletedAt)];
  if (opts.companyId) conds.push(eq(financialReports.companyId, opts.companyId));
  const reps = await db
    .select({ r: financialReports, company: companies.name })
    .from(financialReports)
    .innerJoin(companies, eq(companies.id, financialReports.companyId))
    .where(and(...conds))
    .orderBy(desc(financialReports.periodEnd), desc(financialReports.createdAt));
  if (!reps.length) return [];
  const versions = await db
    .select({ v: reportVersions, by: admins.name })
    .from(reportVersions)
    .leftJoin(admins, eq(admins.id, reportVersions.uploadedBy))
    .where(inArray(reportVersions.reportId, reps.map((x) => x.r.id)))
    .orderBy(desc(reportVersions.versionNo));
  const currentIds = reps.map((x) => x.r.currentVersionId).filter((x): x is string => !!x);
  const metrics = currentIds.length ? await db.select().from(financialMetrics).where(inArray(financialMetrics.reportVersionId, currentIds)) : [];
  const FIELDS = ["revenue", "grossProfit", "operatingIncome", "netIncome", "eps", "dps", "totalAssets", "totalLiabilities", "totalEquity", "currentAssets", "currentLiabilities", "totalDebt", "cash", "operatingCashFlow", "capex", "sharesOutstanding"] as const;

  return reps
    .map(({ r, company }) => {
      const vs = versions
        .filter((x) => x.v.reportId === r.id)
        .map(({ v, by }) => ({
          id: v.id,
          versionNo: v.versionNo,
          fileName: v.fileName,
          createdAt: v.createdAt.toISOString(),
          by,
          pageCount: v.pageCount,
          status: v.status,
          note: v.note,
          error: v.error,
        }));
      const current = vs.find((v) => v.id === r.currentVersionId);
      if (!current) return null;
      const metricValues = metrics.filter((m) => m.reportVersionId === current.id).reduce((n, m) => n + FIELDS.filter((f) => m[f] !== null).length, 0);
      return {
        reportId: r.id,
        companyId: r.companyId,
        companyName: company,
        title: r.title,
        type: r.type,
        fiscalYear: r.fiscalYear,
        fiscalPeriod: r.fiscalPeriod,
        periodEnd: r.periodEnd,
        current,
        versions: vs,
        metricValues,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}
