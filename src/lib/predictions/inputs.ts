import "server-only";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  companies,
  companyEvents,
  financialMetrics,
  financialReports,
  qualitativeInsights,
  reportVersions,
  sectors,
} from "@/lib/db/schema";
import { getSettings, type AppSettings } from "@/lib/settings";
import type { MetricRow } from "@/lib/valuation/aggregate";
import type { BasedOnReport, SectorBenchmarks } from "@/lib/valuation/types";

/** Bump when the valuation engine changes, so every company recomputes on the next run. */
export const ENGINE_VERSION = "engine-1";

export interface ReportRef {
  reportId: string;
  versionId: string;
  versionNo: number;
  title: string;
  type: string;
  fiscalYear: number;
  fiscalPeriod: string;
  periodEnd: string | null;
  createdAt: Date;
}

export interface InsightInput {
  id: string;
  reportVersionId: string;
  category: string;
  summary: string;
  sentiment: number;
  impact: "low" | "med" | "high";
  evidenceQuote: string | null;
  page: number | null;
}

export interface CompanyInputs {
  company: typeof companies.$inferSelect;
  sector: SectorBenchmarks;
  settings: AppSettings;
  reports: ReportRef[];
  metrics: (MetricRow & { reportVersionId: string })[];
  insights: InsightInput[];
  events: { id: string; title: string; body: string | null; sentiment: number; date: string; sourceUrl: string | null }[];
}

const DEFAULT_SECTOR: SectorBenchmarks = { name: "Market", pe: 10, growth: 0.06, roe: 0.12 };

/** Current, non-deleted reports whose current version is approved. */
export async function approvedReports(companyId: string): Promise<ReportRef[]> {
  const rows = await db
    .select({
      reportId: financialReports.id,
      versionId: reportVersions.id,
      versionNo: reportVersions.versionNo,
      title: financialReports.title,
      type: financialReports.type,
      fiscalYear: financialReports.fiscalYear,
      fiscalPeriod: financialReports.fiscalPeriod,
      periodEnd: financialReports.periodEnd,
      createdAt: reportVersions.createdAt,
    })
    .from(financialReports)
    .innerJoin(reportVersions, eq(reportVersions.id, financialReports.currentVersionId))
    .where(and(eq(financialReports.companyId, companyId), isNull(financialReports.deletedAt), eq(reportVersions.status, "approved")))
    .orderBy(desc(financialReports.periodEnd));
  return rows;
}

export async function loadCompanyInputs(companyId: string, asOf = new Date()): Promise<CompanyInputs | null> {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) return null;
  const sectorRow = company.sectorId ? await db.query.sectors.findFirst({ where: eq(sectors.id, company.sectorId) }) : null;
  const settings = await getSettings();
  const reports = await approvedReports(companyId);
  const versionIds = reports.map((r) => r.versionId);
  const byVersion = new Map(reports.map((r) => [r.versionId, r]));

  const metricRows = versionIds.length
    ? await db.select().from(financialMetrics).where(inArray(financialMetrics.reportVersionId, versionIds))
    : [];
  const insightRows = versionIds.length
    ? await db
        .select()
        .from(qualitativeInsights)
        .where(and(inArray(qualitativeInsights.reportVersionId, versionIds), eq(qualitativeInsights.included, true)))
    : [];
  const since = new Date(asOf);
  since.setUTCMonth(since.getUTCMonth() - 18);
  const events = await db
    .select()
    .from(companyEvents)
    .where(and(eq(companyEvents.companyId, companyId), gte(companyEvents.date, since.toISOString().slice(0, 10))))
    .orderBy(desc(companyEvents.date));

  return {
    company,
    sector: sectorRow
      ? { name: sectorRow.name, pe: sectorRow.benchmarkPe, growth: sectorRow.benchmarkGrowth, roe: sectorRow.benchmarkRoe }
      : DEFAULT_SECTOR,
    settings,
    reports,
    metrics: metricRows.map((m) => {
      const r = byVersion.get(m.reportVersionId);
      return {
        reportVersionId: m.reportVersionId,
        fiscalYear: m.fiscalYear,
        period: m.period,
        periodEnd: r && r.fiscalYear === m.fiscalYear ? r.periodEnd : null,
        unitMultiplier: m.unitMultiplier,
        reportType: r?.type ?? null,
        createdAt: r?.createdAt ?? null,
        revenue: m.revenue,
        grossProfit: m.grossProfit,
        operatingIncome: m.operatingIncome,
        netIncome: m.netIncome,
        eps: m.eps,
        dps: m.dps,
        totalAssets: m.totalAssets,
        totalLiabilities: m.totalLiabilities,
        totalEquity: m.totalEquity,
        currentAssets: m.currentAssets,
        currentLiabilities: m.currentLiabilities,
        totalDebt: m.totalDebt,
        cash: m.cash,
        operatingCashFlow: m.operatingCashFlow,
        capex: m.capex,
        sharesOutstanding: m.sharesOutstanding,
      };
    }),
    insights: insightRows.map((i) => ({
      id: i.id,
      reportVersionId: i.reportVersionId,
      category: i.category,
      summary: i.summary,
      sentiment: i.sentiment,
      impact: i.impact,
      evidenceQuote: i.evidenceQuote,
      page: i.page,
    })),
    events: events.map((e) => ({ id: e.id, title: e.title, body: e.body, sentiment: e.sentiment, date: e.date, sourceUrl: e.sourceUrl })),
  };
}

/** Hash of everything that feeds a prediction. Unchanged inputs mean no new prediction is needed. */
export function hashInputs(i: CompanyInputs): string {
  const payload = {
    engine: ENGINE_VERSION,
    price: i.company.currentPrice,
    shares: i.company.sharesOutstanding,
    sector: i.sector,
    valuation: i.settings.valuation,
    reports: i.reports.map((r) => r.versionId).sort(),
    metrics: i.metrics
      .map((m) => ({ ...m, createdAt: undefined }))
      .sort((a, b) => (a.reportVersionId + a.fiscalYear + a.period).localeCompare(b.reportVersionId + b.fiscalYear + b.period)),
    insights: i.insights.map((x) => [x.id, x.sentiment, x.impact]).sort(),
    events: i.events.map((e) => [e.id, e.sentiment, e.date]).sort(),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function reportLabel(r: Pick<ReportRef, "title">, page?: number | null): string {
  const short = r.title.replace(/ Report$/, "");
  return page ? `${short}, p.${page}` : short;
}

export function basedOn(reports: ReportRef[]): BasedOnReport[] {
  return reports.map((r) => ({ reportId: r.reportId, versionId: r.versionId, title: r.title, versionNo: r.versionNo, periodEnd: r.periodEnd }));
}
