import { CodingQueue } from "@/components/evidence/coding-queue";
import { aiMocked } from "@/lib/evidence/ai";
import { getRecords } from "@/lib/evidence/data";
import { loadStudy } from "@/lib/evidence/page";
import { env } from "@/lib/env";

export const metadata = { title: "Evidence coding" };
export const dynamic = "force-dynamic";

export default async function CodingPage({ params, searchParams }: { params: Promise<{ studyId: string }>; searchParams: Promise<{ running?: string }> }) {
  const { studyId } = await params;
  const { running } = await searchParams;
  const { bundle, canWrite } = await loadStudy(studyId);
  const records = await getRecords(studyId);
  const entity = new Map(bundle.entities.map((e) => [e.id, e]));
  const queue = records.filter((r) => r.included && (r.codingStatus === "ai_suggested" || r.codingStatus === "uncoded"));
  // Suggestions first, then uncoded in record order.
  queue.sort((a, b) => Number(b.codingStatus === "ai_suggested") - Number(a.codingStatus === "ai_suggested") || a.recordCode.localeCompare(b.recordCode));
  const interpretable = (r: (typeof records)[number]) => bundle.study.languages.includes(r.language) || !!r.translationEn;

  return (
    <CodingQueue
      studyId={studyId}
      canWrite={canWrite}
      running={running === "1"}
      aiLabel={aiMocked() ? "Offline keyword rules (Gemini not configured)" : `Gemini (${env.flashModel})`}
      themes={bundle.themes.map((t) => ({ key: t.key, label: t.label, description: t.description }))}
      uncodedIds={queue.filter((r) => r.codingStatus === "uncoded" && interpretable(r)).map((r) => r.id)}
      records={queue.map((r) => ({
        id: r.id,
        recordCode: r.recordCode,
        entity: entity.get(r.entityId)?.name ?? "—",
        requiresGeoCheck: entity.get(r.entityId)?.requiresGeoCheck ?? false,
        geoConfirmed: r.geoConfirmed,
        platform: r.platform,
        product: r.product,
        productEvidence: r.productEvidence,
        text: r.text,
        language: r.language,
        translationEn: r.translationEn,
        themeKeys: r.themeKeys,
        sentiment: r.sentiment,
        switching: r.switching,
        switchingNote: r.switchingNote,
        suggestion: r.codingStatus === "ai_suggested" ? (r.aiSuggestion ?? null) : null,
      }))}
    />
  );
}
