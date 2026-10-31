import { QaBoard } from "@/components/evidence/qa-board";
import { agreement } from "@/lib/evidence/agreement";
import { adminNames, getRecords } from "@/lib/evidence/data";
import { loadStudy } from "@/lib/evidence/page";
import type { QaField } from "@/lib/evidence/types";

export const metadata = { title: "Evidence QA" };
export const dynamic = "force-dynamic";

export default async function QaPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const { user, bundle, canWrite } = await loadStudy(studyId);
  const records = await getRecords(studyId);
  const sample = records.filter((r) => r.inQaSample || r.codingStatus === "disputed");
  const eligible = records.filter((r) => r.included && ["coded", "checked", "disputed"].includes(r.codingStatus)).length;
  const names = await adminNames(sample.flatMap((r) => [r.codedBy, r.checkedBy]));
  const entity = new Map(bundle.entities.map((e) => [e.id, e.name]));
  const label = new Map(bundle.themes.map((t) => [t.key, t.label]));
  const checks = sample.filter((r) => r.checkFields).map((r) => ({ checkFields: r.checkFields as Partial<Record<QaField, "agree" | "disagree">> }));

  return (
    <QaBoard
      studyId={studyId}
      me={user.id}
      canWrite={canWrite}
      rate={bundle.study.qaRate}
      eligible={eligible}
      agreement={agreement(checks)}
      records={sample.map((r) => ({
        id: r.id,
        recordCode: r.recordCode,
        entity: entity.get(r.entityId) ?? "—",
        text: r.text,
        translationEn: r.translationEn,
        themes: r.themeKeys.map((k) => label.get(k) ?? k),
        sentiment: r.sentiment,
        switching: r.switching,
        switchingNote: r.switchingNote,
        included: r.included,
        exclusionReason: r.exclusionReason,
        codingStatus: r.codingStatus,
        codedBy: r.codedBy,
        codedByName: r.codedBy ? (names[r.codedBy] ?? null) : null,
        checkedByName: r.checkedBy ? (names[r.checkedBy] ?? null) : null,
        checkFields: r.checkFields as QaRecordFields,
        checkNote: r.checkNote,
      }))}
    />
  );
}

type QaRecordFields = Partial<Record<QaField, "agree" | "disagree">> | null;
