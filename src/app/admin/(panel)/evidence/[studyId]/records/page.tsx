import { notFound } from "next/navigation";
import { RecordsTable } from "@/components/evidence/records-table";
import { studyAnalysis } from "@/lib/evidence/data";
import { loadStudy } from "@/lib/evidence/page";

export const metadata = { title: "Evidence records" };
export const dynamic = "force-dynamic";

export default async function RecordsPage({ params, searchParams }: { params: Promise<{ studyId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { studyId } = await params;
  const { view } = await searchParams;
  const { bundle, canWrite, canApprove } = await loadStudy(studyId);
  const a = await studyAnalysis(studyId);
  if (!a) notFound();
  const groupName = Object.fromEntries(bundle.groups.map((g) => [g.id, g.name]));
  return (
    <RecordsTable
      studyId={studyId}
      canWrite={canWrite}
      canApprove={canApprove}
      initialView={view === "duplicates" ? "duplicates" : "records"}
      collectionDate={bundle.study.collectionDate}
      entities={bundle.entities.map((e) => ({ id: e.id, name: e.name, group: groupName[e.groupId] ?? "", requiresGeoCheck: e.requiresGeoCheck }))}
      themes={bundle.themes.map((t) => ({ key: t.key, label: t.label }))}
      duplicates={a.duplicates}
      rows={a.records.map((r) => ({
        id: r.id,
        recordCode: r.recordCode,
        platform: r.platform,
        sourceUrl: r.sourceUrl ?? "",
        postedAt: r.postedAt ?? "",
        collectionDate: r.collectionDate ?? "",
        threadId: r.threadId ?? "",
        contributorRef: r.contributorRef ?? "",
        starRating: r.starRating ? String(r.starRating) : "",
        entityId: r.entityId,
        product: r.product,
        productEvidence: r.productEvidence ?? "",
        geoConfirmed: r.geoConfirmed,
        text: r.text,
        language: r.language,
        translationEn: r.translationEn ?? "",
        sentiment: r.sentiment ?? "",
        switching: r.switching,
        switchingNote: r.switchingNote ?? "",
        themeKeys: r.themeKeys,
        included: r.included,
        exclusionReason: r.exclusionReason ?? "",
        inclusionNote: r.inclusionNote ?? "",
        codingStatus: r.codingStatus,
        inQaSample: r.inQaSample,
        publicExample: r.publicExample,
        hasEmbedding: !!r.embedding,
      }))}
    />
  );
}
