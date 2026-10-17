import { asc, desc, inArray } from "drizzle-orm";
import { PredictionsAdmin, type PredictionSummary, type CompanyPredictions } from "@/components/admin/predictions-admin";
import { can, requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { companies, predictions, type Prediction } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Predictions" };
export const dynamic = "force-dynamic";

const summary = (p: Prediction): PredictionSummary => ({
  id: p.id,
  version: p.version,
  status: p.status,
  basePrice: p.basePrice,
  currency: p.currency,
  scenarios: p.scenarios,
  confidence: p.confidence,
  autoviseScore: p.autoviseScore,
  assumptions: p.assumptions,
  factorScores: p.factorScores,
  trigger: p.trigger,
  modelVersion: p.modelVersion,
  overrideNotes: p.overrideNotes ?? [],
  createdAt: p.createdAt.toISOString(),
  publishedAt: p.publishedAt?.toISOString() ?? null,
});

export default async function PredictionsPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const user = await requirePageAdmin();
  const { company } = await searchParams;
  const settings = await getSettings();
  const cos = await db.select().from(companies).orderBy(asc(companies.name));
  const preds = cos.length
    ? await db
        .select()
        .from(predictions)
        .where(inArray(predictions.companyId, cos.map((c) => c.id)))
        .orderBy(desc(predictions.version))
    : [];

  const list: CompanyPredictions[] = cos.map((c) => {
    const mine = preds.filter((p) => p.companyId === c.id);
    const draft = mine.find((p) => p.status === "draft");
    const published = mine.find((p) => p.status === "published");
    return {
      company: { id: c.id, slug: c.slug, name: c.name, ticker: c.ticker, logoUrl: c.logoUrl, logoDarkUrl: c.logoDarkUrl, logoBg: c.logoBg, logoShape: c.logoShape, brandColor: c.brandColor, currency: c.currency, price: c.currentPrice },
      draft: draft ? summary(draft) : null,
      published: published ? summary(published) : null,
      history: mine.filter((p) => p.status === "archived").slice(0, 5).map((p) => ({ version: p.version, base: p.scenarios.base.y3, publishedAt: p.publishedAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString() })),
    };
  });
  // Drafts first, then published, then companies still waiting.
  list.sort((a, b) => Number(!!b.draft) - Number(!!a.draft) || Number(!!b.published) - Number(!!a.published) || a.company.name.localeCompare(b.company.name));
  const selected = list.find((l) => l.company.slug === company)?.company.slug ?? list[0]?.company.slug ?? null;

  return (
    <PredictionsAdmin
      list={list}
      selected={selected}
      canPublish={can(user.role, "predictions.publish")}
      minConfidence={settings.publishing.minConfidenceToPublish}
    />
  );
}

