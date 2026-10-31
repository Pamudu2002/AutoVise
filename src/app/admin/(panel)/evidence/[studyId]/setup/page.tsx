import { SetupForm } from "@/components/evidence/setup-form";
import { loadStudy } from "@/lib/evidence/page";

export const metadata = { title: "Study setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const { bundle, canWrite } = await loadStudy(studyId);
  const { study } = bundle;
  return (
    <SetupForm
      key={study.updatedAt.toISOString()}
      studyId={studyId}
      canWrite={canWrite}
      initial={{
        title: study.title,
        collectionDate: study.collectionDate,
        windowMonths: study.windowMonths,
        languages: study.languages,
        languageLimitations: study.languageLimitations ?? "",
        minNForPercent: study.minNForPercent,
        qaRate: study.qaRate,
        notes: study.notes ?? "",
        limitations: study.limitations ?? "",
        questions: bundle.questions.map((q) => ({ id: q.id, question: q.question, reportSection: q.reportSection })),
        themes: bundle.themes.map((t) => ({ id: t.id, key: t.key, label: t.label, description: t.description ?? "", investmentRelevance: t.investmentRelevance ?? "" })),
      }}
      groups={bundle.groups.map((g) => ({
        id: g.id,
        name: g.name,
        entities: bundle.entities.filter((e) => e.groupId === g.id).map((e) => ({ id: e.id, name: e.name, isSubject: e.isSubject, requiresGeoCheck: e.requiresGeoCheck })),
      }))}
      targets={bundle.targets.map((t) => ({ id: t.id, label: t.label, groupId: t.groupId, product: t.product, platform: t.platform, perEntity: t.perEntity, targetMin: t.targetMin, targetMax: t.targetMax }))}
    />
  );
}
