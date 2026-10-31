import { notFound } from "next/navigation";
import { AppendixPublish } from "@/components/evidence/appendix-publish";
import { EvidenceAppendix } from "@/components/evidence/evidence-appendix";
import { appendixFor, getFindings } from "@/lib/evidence/data";
import { loadStudy } from "@/lib/evidence/page";

export const metadata = { title: "Evidence appendix" };
export const dynamic = "force-dynamic";

export default async function AppendixPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const { bundle, canApprove } = await loadStudy(studyId);
  const [data, findings] = await Promise.all([appendixFor(studyId), getFindings(studyId)]);
  if (!data) notFound();
  const approved = findings.filter((f) => f.status === "approved");
  const question = new Map(bundle.questions.map((q) => [q.id, q.question]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AppendixPublish studyId={studyId} published={bundle.study.appendixPublished} slug={bundle.company.slug} canApprove={canApprove} approved={approved.length} />
      <p className="hint">Preview. Choose example accounts on the Records tab (checked records only, up to five).</p>
      <div className="card" style={{ padding: 24 }}>
        <EvidenceAppendix data={data} findings={approved.map((f) => ({ question: (f.researchQuestionId && question.get(f.researchQuestionId)) || "", text: f.text, support: f.support }))} />
      </div>
    </div>
  );
}
