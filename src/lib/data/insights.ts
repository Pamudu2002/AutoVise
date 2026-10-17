import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, lte, or } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache";
import { db } from "@/lib/db";
import { companies, predictions, priceHistory, sectors } from "@/lib/db/schema";
import { toHundred } from "@/lib/valuation/qualitative";
import { FACTOR_KEYS } from "@/lib/valuation/types";
import { getCards, type CompanyBrand } from "./public";

// ─── Compare ──────────────────────────────────────────────────────────────
export interface CompareRow extends CompanyBrand {
  sector: string;
  currency: string;
  price: number | null;
  target: number | null;
  bear: number | null;
  bull: number | null;
  horizonDate: string | null;
  confidence: number | null;
  score: number | null;
  pe: number | null;
  dividendYield: number | null;
  roe: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  isBank: boolean;
  latestReport: string | null;
  factors: number[] | null;
}

async function loadCompare(): Promise<CompareRow[]> {
  const cards = await getCards();
  const ids = cards.map((c) => c.id);
  const preds = ids.length ? await db.select().from(predictions).where(and(inArray(predictions.companyId, ids), eq(predictions.status, "published"))) : [];
  const byCompany = new Map(preds.map((p) => [p.companyId, p]));
  return cards.map((c) => {
    const p = byCompany.get(c.id);
    const r = p?.assumptions.ratios;
    const latest = p?.basedOn?.[0]?.title ?? null;
    return {
      ...c,
      price: c.price,
      target: p?.scenarios.base.y3 ?? null,
      bear: p?.scenarios.bear.y3 ?? null,
      bull: p?.scenarios.bull.y3 ?? null,
      horizonDate: p?.assumptions.horizonDate ?? null,
      confidence: p?.confidence ?? null,
      score: p?.autoviseScore ?? null,
      pe: r && c.price && p ? c.price / p.assumptions.eps0 : null,
      dividendYield: r?.dps && c.price ? r.dps / c.price : null,
      roe: r?.roe ?? null,
      netMargin: r?.netMargin ?? null,
      debtToEquity: r?.debtToEquity ?? null,
      isBank: c.sector.toLowerCase().includes("bank"),
      latestReport: latest,
      factors: p ? FACTOR_KEYS.map((k) => toHundred(p.factorScores.find((f) => f.key === k)?.score ?? 0)) : null,
    };
  });
}

export const getCompareRows = unstable_cache(loadCompare, ["compare"], { tags: [TAGS.companies], revalidate: 300 });

// ─── Track record ─────────────────────────────────────────────────────────
export interface Checkpoint {
  id: string;
  company: CompanyBrand;
  sector: string;
  currency: string;
  made: string;
  year: number;
  due: string;
  start: number;
  predicted: number;
  low: number;
  high: number;
  actual: number | null;
  hit: boolean | null;
  directionOk: boolean | null;
  error: number | null;
}

const addYears = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCFullYear(x.getUTCFullYear() + n);
  return x;
};

/** Every 12-month checkpoint of every published (now archived or live) prediction, scored against actual prices. */
async function loadTrackRecord(): Promise<{ resolved: Checkpoint[]; open: Checkpoint[] }> {
  const rows = await db
    .select({ p: predictions, c: companies, sector: sectors.name })
    .from(predictions)
    .innerJoin(companies, eq(companies.id, predictions.companyId))
    .leftJoin(sectors, eq(sectors.id, companies.sectorId))
    .where(and(eq(companies.status, "published"), isNotNull(predictions.publishedAt), or(eq(predictions.status, "published"), eq(predictions.status, "archived"))))
    .orderBy(asc(predictions.publishedAt));

  const now = new Date();
  const resolved: Checkpoint[] = [];
  const open: Checkpoint[] = [];
  for (const { p, c, sector } of rows) {
    const made = p.publishedAt!;
    for (const n of [1, 2, 3] as const) {
      const due = addYears(made, n);
      const key = `y${n}` as const;
      const base: Checkpoint = {
        id: `${p.id}-${n}`,
        company: { id: c.id, slug: c.slug, name: c.name, ticker: c.ticker, logoUrl: c.logoUrl, logoDarkUrl: c.logoDarkUrl, logoBg: c.logoBg, logoShape: c.logoShape, brandColor: c.brandColor },
        sector: sector ?? "Other",
        currency: p.currency,
        made: made.toISOString(),
        year: n,
        due: due.toISOString(),
        start: p.basePrice,
        predicted: p.scenarios.base[key],
        low: p.scenarios.bear[key],
        high: p.scenarios.bull[key],
        actual: null,
        hit: null,
        directionOk: null,
        error: null,
      };
      if (due > now) {
        open.push(base);
        continue;
      }
      const [px] = await db
        .select({ price: priceHistory.price, date: priceHistory.date })
        .from(priceHistory)
        .where(and(eq(priceHistory.companyId, c.id), lte(priceHistory.date, due.toISOString().slice(0, 10))))
        .orderBy(desc(priceHistory.date))
        .limit(1);
      // Only score against a price within two weeks of the checkpoint.
      if (!px || due.getTime() - new Date(px.date + "T00:00:00Z").getTime() > 14 * 86_400_000) {
        open.push(base);
        continue;
      }
      const actual = px.price;
      resolved.push({
        ...base,
        actual,
        hit: actual >= base.low && actual <= base.high,
        directionOk: Math.sign(base.predicted - base.start) === Math.sign(actual - base.start),
        error: (actual - base.predicted) / base.predicted,
      });
    }
  }
  return { resolved: resolved.sort((a, b) => a.due.localeCompare(b.due)), open };
}

export const getTrackRecord = unstable_cache(loadTrackRecord, ["track-record"], { tags: [TAGS.trackRecord, TAGS.companies], revalidate: 3600 });
