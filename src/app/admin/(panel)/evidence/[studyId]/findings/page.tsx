import { FindingsBoard } from "@/components/evidence/findings-board";
import { adminNames, getFindings, getRecords } from "@/lib/evidence/data";
import { loadStudy } from "@/lib/evidence/page";

export const metadata = { title: "Evidence findings" };
export const dynamic = "force-dynamic";

export default async function FindingsPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const { bundle, canWrite, canApprove } = await loadStudy(studyId);
  const [findings, records] = await Promise.all([getFindings(studyId), getRecords(studyId)]);
  const byId = new Map(records.map((r) => [r.id, r]));
  const names = await adminNames(findings.map((f) => f.approvedBy));
  return (
    <FindingsBoard
      studyId={studyId}
      canWrite={canWrite}
      canApprove={canApprove}
      checkedCount={records.filter((r) => r.included && r.codingStatus === "checked").length}
      questions={bundle.questions.map((q) => ({ id: q.id, question: q.question, section: q.reportSection }))}
      findings={findings.map((f) => {
        const cited = f.citedRecordIds.map((id) => byId.get(id)).filter((r) => !!r);
        return {
          id: f.id,
          questionId: f.researchQuestionId,
          text: f.text,
          support: f.support,
          citedCodes: cited.map((r) => r.recordCode),
          citedNotReady: cited.filter((r) => !r.included || r.codingStatus !== "checked").map((r) => r.recordCode),
          warnings: f.guardWarnings,
          status: f.status,
          generatedBy: f.generatedBy,
          approvedByName: f.approvedBy ? (names[f.approvedBy] ?? null) : null,
          approvedAt: f.approvedAt ? f.approvedAt.toISOString() : null,
        };
      })}
    />
  );
}
