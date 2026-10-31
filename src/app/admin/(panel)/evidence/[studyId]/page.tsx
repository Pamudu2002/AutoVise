import Link from "next/link";
import { notFound } from "next/navigation";
import { Kpi } from "@/components/admin/page-header";
import { NoteList } from "@/components/evidence/notes";
import { StatusControl } from "@/components/evidence/status-control";
import { TargetsProgress } from "@/components/evidence/targets-progress";
import { getFindings, studyAnalysis } from "@/lib/evidence/data";
import { loadStudy } from "@/lib/evidence/page";

export const metadata = { title: "Customer evidence study" };
export const dynamic = "force-dynamic";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function StudyOverview({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const { canWrite } = await loadStudy(studyId);
  const [a, findings] = await Promise.all([studyAnalysis(studyId), getFindings(studyId)]);
  if (!a) notFound();
  const { records, bundle } = a;
  const included = records.filter((r) => r.included);
  const coded = included.filter((r) => r.codingStatus === "coded" || r.codingStatus === "checked").length;
  const checked = records.filter((r) => r.codingStatus === "checked").length;
  const disputed = records.filter((r) => r.codingStatus === "disputed").length;
  const qaOpen = records.filter((r) => r.inQaSample && r.codingStatus === "coded").length;
  const approved = findings.filter((f) => f.status === "approved").length;
  const entityName = Object.fromEntries(bundle.entities.map((e) => [e.id, e.name]));
  const base = `/admin/evidence/${studyId}`;

  const next: [string, string][] = [];
  if (!bundle.screenings.some((s) => s.decision === "selected")) next.push(["Screen the platforms and select at least one.", `${base}/screening`]);
  if (!records.length) next.push(["Import the collection spreadsheet.", `${base}/records/import`]);
  if (records.some((r) => r.included && (r.codingStatus === "uncoded" || r.codingStatus === "ai_suggested"))) next.push(["Code the remaining records (AI-assisted coding can draft suggestions).", `${base}/coding`]);
  if (qaOpen) next.push([`Check ${plural(qaOpen, "record")} in the QA sample (a second person).`, `${base}/qa`]);
  if (disputed) next.push([`Resolve ${plural(disputed, "disputed record")}.`, `${base}/qa`]);
  if (a.duplicates.length) next.push([`Review ${plural(a.duplicates.length, "possible duplicate pair")}.`, `${base}/records?view=duplicates`]);
  if (checked && !approved) next.push(["Draft findings for each research question and send them for approval.", `${base}/findings`]);
  if (approved && !bundle.study.appendixPublished) next.push(["Publish the methodology appendix.", `${base}/appendix`]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <StatusControl studyId={studyId} status={bundle.study.status} canWrite={canWrite} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <Kpi label="Records" value={records.length} note={`${included.length} included · ${records.length - included.length} excluded`} />
        <Kpi label="Coded" value={`${coded} / ${included.length}`} note="Included records with human coding" />
        <Kpi label="Checked in QA" value={checked} note={disputed ? `${disputed} disputed` : "Second-person checks"} danger={disputed > 0} />
        <Kpi label="Approved findings" value={approved} note={`${findings.filter((f) => f.status === "draft").length} drafts`} />
      </div>
      {next.length > 0 && (
        <section className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Next steps</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {next.map(([t, href]) => (
              <li key={t}>
                <Link href={href}>{t}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <NoteList items={a.warnings} title="Sample warnings" />
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Collection targets</h2>
        <p className="hint">Practical targets for an exploratory study. Meeting them does not make the sample representative.</p>
        <TargetsProgress progress={a.progress} entityName={entityName} />
      </section>
      {bundle.study.notes && (
        <section className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Team notes</h2>
          <p style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--muted)" }}>{bundle.study.notes}</p>
        </section>
      )}
    </div>
  );
}
