import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache";
import { fmtDate } from "@/lib/format";
import { db } from "@/lib/db";
import {
  companies,
  financialMetrics,
  financialReports,
  predictions,
  priceHistory,
  reportVersions,
  sectors,
  type Prediction,
} from "@/lib/db/schema";
import { buildHistory, type MetricRow } from "@/lib/valuation/aggregate";
import type { AnnualFinancials } from "@/lib/valuation/types";
import type { LogoBg, LogoShape } from "@/lib/logo-tile";

export interface CompanyBrand {
  id: string;
  slug: string;
  name: string;
  ticker: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  logoBg: LogoBg;
  logoShape: LogoShape;
  brandColor: string | null;
}

export interface CardData extends CompanyBrand {
  sector: string;
  currency: string;
  price: number | null;
  priceUpdatedAt: string | null;
  target: number | null;
  upside: number | null;
  confidence: number | null;
  score: number | null;
  horizonDate: string | null;
  /** Weekly closes for the sparkline, oldest first. */
  spark: number[];
  projection: number[];
  pendingNote: string | null;
  outdatedLabel: string | null;
}

const brandOf = (c: typeof companies.$inferSelect): CompanyBrand => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  ticker: c.ticker,
  logoUrl: c.logoUrl,
  logoDarkUrl: c.logoDarkUrl,
  logoBg: c.logoBg,
  logoShape: c.logoShape,
  brandColor: c.brandColor,
});

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Evenly samples a series down to n points, always keeping the last one. */
export function sample<T>(values: T[], n: number): T[] {
  if (values.length <= n) return values;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(values[Math.round((i * (values.length - 1)) / (n - 1))]);
  return out;
}

const OUTDATED_MONTHS = 12;

function outdatedLabel(latestPeriodEnd: string | null, fiscalYear: number | null, now = new Date()): string | null {
  if (!latestPeriodEnd) return null;
  const months = (now.getTime() - new Date(latestPeriodEnd + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return months > OUTDATED_MONTHS ? `Outdated data · reports from FY${fiscalYear ?? latestPeriodEnd.slice(0, 4)}` : null;
}

async function publishedPredictions(companyIds: string[]) {
  if (!companyIds.length) return new Map<string, Prediction>();
  const rows = await db.select().from(predictions).where(and(inArray(predictions.companyId, companyIds), eq(predictions.status, "published")));
  return new Map(rows.map((p) => [p.companyId, p]));
}

/** Current report versions per company (any status), newest period first. */
async function currentReports(companyIds: string[]) {
  if (!companyIds.length) return [];
  return db
    .select({
      companyId: financialReports.companyId,
      reportId: financialReports.id,
      title: financialReports.title,
      type: financialReports.type,
      fiscalYear: financialReports.fiscalYear,
      fiscalPeriod: financialReports.fiscalPeriod,
      periodEnd: financialReports.periodEnd,
      versionId: reportVersions.id,
      versionNo: reportVersions.versionNo,
      status: reportVersions.status,
      pageCount: reportVersions.pageCount,
      approvedAt: reportVersions.approvedAt,
      blobUrl: reportVersions.blobUrl,
    })
    .from(financialReports)
    .innerJoin(reportVersions, eq(reportVersions.id, financialReports.currentVersionId))
    .where(and(inArray(financialReports.companyId, companyIds), isNull(financialReports.deletedAt)))
    .orderBy(desc(financialReports.periodEnd), desc(financialReports.fiscalYear));
}

async function loadCards(): Promise<CardData[]> {
  const rows = await db
    .select({ c: companies, sector: sectors.name })
    .from(companies)
    .leftJoin(sectors, eq(sectors.id, companies.sectorId))
    .where(eq(companies.status, "published"))
    .orderBy(asc(companies.name));
  const ids = rows.map((r) => r.c.id);
  const preds = await publishedPredictions(ids);
  const reports = await currentReports(ids);
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 2);
  const prices = ids.length
    ? await db
        .select({ companyId: priceHistory.companyId, price: priceHistory.price })
        .from(priceHistory)
        .where(and(inArray(priceHistory.companyId, ids), gte(priceHistory.date, since.toISOString().slice(0, 10))))
        .orderBy(asc(priceHistory.date))
    : [];

  return rows.map(({ c, sector }) => {
    const p = preds.get(c.id);
    const rs = reports.filter((r) => r.companyId === c.id);
    const approved = rs.filter((r) => r.status === "approved");
    const inReview = rs.find((r) => r.status === "review" || r.status === "processing" || r.status === "uploaded");
    const spark = sample(prices.filter((x) => x.companyId === c.id).map((x) => x.price), 24);
    const price = c.currentPrice;
    return {
      ...brandOf(c),
      sector: sector ?? "Other",
      currency: c.currency,
      price,
      priceUpdatedAt: iso(c.priceUpdatedAt),
      target: p ? p.scenarios.base.y3 : null,
      upside: p && price ? p.scenarios.base.y3 / price - 1 : null,
      confidence: p?.confidence ?? null,
      score: p?.autoviseScore ?? null,
      horizonDate: p?.assumptions.horizonDate ?? null,
      spark,
      projection: p ? [p.scenarios.base.y1, p.scenarios.base.y2, p.scenarios.base.y3] : [],
      pendingNote: p ? null : inReview ? `${inReview.title} is in review.` : "Waiting for reports.",
      outdatedLabel: p ? outdatedLabel(approved[0]?.periodEnd ?? null, approved[0]?.fiscalYear ?? null) : null,
    };
  });
}

export const getCards = unstable_cache(loadCards, ["cards"], { tags: [TAGS.companies], revalidate: 300 });

export interface SourceReport {
  reportId: string;
  versionId: string;
  title: string;
  type: string;
  fiscalPeriod: string;
  periodEnd: string | null;
  versionNo: number;
  status: string;
  pageCount: number | null;
  approvedAt: string | null;
  url: string;
  note: string;
}

export interface CompanyPageData {
  company: CompanyBrand & {
    description: string | null;
    website: string | null;
    currency: string;
    sector: string;
    sectorPe: number | null;
    price: number | null;
    priceUpdatedAt: string | null;
    status: "draft" | "published";
  };
  prediction: (Omit<Prediction, "createdAt" | "publishedAt"> & { createdAt: string; publishedAt: string | null }) | null;
  prices: { date: string; price: number }[];
  history: AnnualFinancials[];
  reports: SourceReport[];
  latestReportDate: string | null;
  outdatedLabel: string | null;
  pendingNote: string | null;
}

async function loadCompanyPage(slug: string): Promise<CompanyPageData | null> {
  const row = await db
    .select({ c: companies, sector: sectors })
    .from(companies)
    .leftJoin(sectors, eq(sectors.id, companies.sectorId))
    .where(eq(companies.slug, slug))
    .limit(1);
  if (!row[0]) return null;
  const { c, sector } = row[0];
  const pred = (await publishedPredictions([c.id])).get(c.id) ?? null;
  const reports = await currentReports([c.id]);
  const approved = reports.filter((r) => r.status === "approved");

  const metrics = approved.length
    ? await db.select().from(financialMetrics).where(inArray(financialMetrics.reportVersionId, approved.map((r) => r.versionId)))
    : [];
  const byVersion = new Map(approved.map((r) => [r.versionId, r]));
  const { history } = buildHistory(
    metrics.map((m): MetricRow => ({ ...m, periodEnd: null, createdAt: byVersion.get(m.reportVersionId)?.approvedAt ?? null })),
  );

  const prices = await db
    .select({ date: priceHistory.date, price: priceHistory.price })
    .from(priceHistory)
    .where(eq(priceHistory.companyId, c.id))
    .orderBy(asc(priceHistory.date));

  // "v1 superseded 02 Apr 2026" notes for reports that were replaced.
  const superseded = reports.length
    ? await db
        .select({ reportId: reportVersions.reportId, versionNo: reportVersions.versionNo, createdAt: reportVersions.createdAt })
        .from(reportVersions)
        .where(and(inArray(reportVersions.reportId, reports.map((r) => r.reportId)), eq(reportVersions.status, "superseded")))
    : [];

  return {
    company: {
      ...brandOf(c),
      description: c.description,
      website: c.website,
      currency: c.currency,
      sector: sector?.name ?? "Other",
      sectorPe: sector?.benchmarkPe ?? null,
      price: c.currentPrice,
      priceUpdatedAt: iso(c.priceUpdatedAt),
      status: c.status,
    },
    prediction: pred ? { ...pred, createdAt: pred.createdAt.toISOString(), publishedAt: iso(pred.publishedAt) } : null,
    prices: sample(prices, 260),
    history,
    reports: approved.map((r) => {
      const old = superseded.filter((s) => s.reportId === r.reportId).sort((a, b) => b.versionNo - a.versionNo)[0];
      const replacedOn = r.approvedAt ?? null;
      return {
        reportId: r.reportId,
        versionId: r.versionId,
        title: r.title,
        type: r.type,
        fiscalPeriod: r.fiscalPeriod,
        periodEnd: r.periodEnd,
        versionNo: r.versionNo,
        status: r.status,
        pageCount: r.pageCount,
        approvedAt: iso(r.approvedAt),
        url: r.blobUrl,
        note: old && replacedOn ? `v${old.versionNo} superseded ${fmtDate(replacedOn)}` : r.approvedAt ? `Approved ${fmtDate(r.approvedAt)}` : "",
      };
    }),
    latestReportDate: approved[0]?.periodEnd ?? null,
    outdatedLabel: pred ? outdatedLabel(approved[0]?.periodEnd ?? null, approved[0]?.fiscalYear ?? null) : null,
    pendingNote: pred
      ? null
      : reports.find((r) => r.status !== "approved")
        ? `${reports.find((r) => r.status !== "approved")!.title} is being processed and reviewed.`
        : "No reports have been approved for this company yet.",
  };
}

export function getCompanyPage(slug: string) {
  return unstable_cache(() => loadCompanyPage(slug), ["company-page", slug], { tags: [TAGS.companies, TAGS.company(slug)], revalidate: 300 })();
}

/** Uncached: admins previewing a draft company see live data. */
export const getCompanyPageUncached = loadCompanyPage;

export async function listPublishedSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: companies.slug }).from(companies).where(eq(companies.status, "published"));
  return rows.map((r) => r.slug);
}
