import { and, asc, count, eq, gte, inArray, isNull } from "drizzle-orm";
import { CompaniesAdmin, type AdminCompanyRow } from "@/components/admin/companies-admin";
import { requirePageAdmin, can } from "@/lib/admin";
import { sectorOptions, tradingDaysBetween } from "@/lib/data/admin";
import { sample } from "@/lib/data/public";
import { db } from "@/lib/db";
import { companies, financialReports, predictions, priceHistory, sectors } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ edit?: string; price?: string; new?: string }> }) {
  const user = await requirePageAdmin();
  const sp = await searchParams;
  const settings = await getSettings();
  const rows = await db.select({ c: companies, sector: sectors.name }).from(companies).leftJoin(sectors, eq(sectors.id, companies.sectorId)).orderBy(asc(companies.name));
  const ids = rows.map((r) => r.c.id);
  const [reportCounts, preds, prices, sectorList] = await Promise.all([
    ids.length
      ? db.select({ companyId: financialReports.companyId, n: count() }).from(financialReports).where(and(inArray(financialReports.companyId, ids), isNull(financialReports.deletedAt))).groupBy(financialReports.companyId)
      : [],
    ids.length ? db.select().from(predictions).where(and(inArray(predictions.companyId, ids), eq(predictions.status, "published"))) : [],
    ids.length
      ? db
          .select({ companyId: priceHistory.companyId, price: priceHistory.price })
          .from(priceHistory)
          .where(and(inArray(priceHistory.companyId, ids), gte(priceHistory.date, new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10))))
          .orderBy(asc(priceHistory.date))
      : [],
    sectorOptions(),
  ]);
  const now = new Date();

  const data: AdminCompanyRow[] = rows.map(({ c, sector }) => {
    const p = preds.find((x) => x.companyId === c.id);
    const days = c.priceUpdatedAt ? tradingDaysBetween(c.priceUpdatedAt, now) : null;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      ticker: c.ticker,
      sectorId: c.sectorId,
      sector: sector ?? "—",
      description: c.description,
      website: c.website,
      currency: c.currency,
      sharesOutstanding: c.sharesOutstanding,
      brandColor: c.brandColor,
      logoUrl: c.logoUrl,
      logoDarkUrl: c.logoDarkUrl,
      logoBg: c.logoBg,
      logoShape: c.logoShape,
      status: c.status,
      price: c.currentPrice,
      priceUpdatedAt: c.priceUpdatedAt?.toISOString() ?? null,
      stale: days === null || days > settings.publishing.stalePriceDays,
      reports: reportCounts.find((x) => x.companyId === c.id)?.n ?? 0,
      target: p?.scenarios.base.y3 ?? null,
      confidence: p?.confidence ?? null,
      projection: p ? [p.scenarios.base.y1, p.scenarios.base.y2, p.scenarios.base.y3] : [],
      spark: sample(prices.filter((x) => x.companyId === c.id).map((x) => x.price), 24),
    };
  });

  return (
    <CompaniesAdmin
      rows={data}
      sectors={sectorList}
      canWrite={can(user.role, "companies.write")}
      openEdit={sp.edit ?? (sp.new ? "new" : null)}
      openPrice={sp.price ?? null}
    />
  );
}

export const dynamic = "force-dynamic";
