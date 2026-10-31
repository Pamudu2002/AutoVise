import { notFound } from "next/navigation";
import { NoteList, SmallSampleNote } from "@/components/evidence/notes";
import { ThemeMatrix } from "@/components/evidence/theme-matrix";
import { studyAnalysis } from "@/lib/evidence/data";
import { sampleCounts } from "@/lib/evidence/matrix";
import { loadStudy } from "@/lib/evidence/page";
import { EXCLUSION_LABEL, type Exclusion } from "@/lib/evidence/types";

export const metadata = { title: "Evidence analysis" };
export const dynamic = "force-dynamic";

export default async function AnalysisPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  await loadStudy(studyId);
  const a = await studyAnalysis(studyId);
  if (!a) notFound();
  const { matrix, bundle, lite, records } = a;
  const excluded = records.filter((r) => !r.included);
  const reasons = Object.entries(
    excluded.reduce<Record<string, number>>((m, r) => {
      const k = r.exclusionReason ?? "other";
      m[k] = (m[k] ?? 0) + 1;
      return m;
    }, {}),
  ).sort((x, y) => y[1] - x[1]);
  const totals = sampleCounts(lite.filter((r) => r.included));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SmallSampleNote min={matrix.minNForPercent} />
      <NoteList items={a.warnings} title="Sample warnings" />
      {matrix.pendingCoding > 0 && <NoteList tone="info" items={[`${matrix.pendingCoding} included record${matrix.pendingCoding === 1 ? " is" : "s are"} not in the matrix yet (uncoded, AI suggestion not accepted, or disputed).`]} />}

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Theme matrix</h2>
        <ThemeMatrix matrix={matrix} themes={bundle.themes.map((t) => ({ key: t.key, label: t.label }))} />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Switching and multi-provider records</h2>
        {matrix.switching.length === 0 ? (
          <p className="hint">No coded switching records.</p>
        ) : (
          <div className="tbl-box">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th className="r">Records</th>
                  <th>Explanations</th>
                </tr>
              </thead>
              <tbody>
                {matrix.switching.map((s) => (
                  <tr key={s.entityId}>
                    <td>{s.entityName}</td>
                    <td className="r num">{s.records.length}</td>
                    <td style={{ fontSize: 13 }}>
                      {s.records.map((r) => (
                        <div key={r.recordCode}>
                          <span className="num">{r.recordCode}</span> {r.note ?? "—"}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Included sample</h2>
          <p className="num" style={{ fontSize: 14 }}>
            {totals.n} records · {totals.threads} threads · {totals.contributors} contributors
            {totals.unknownContributors > 0 && ` · ${totals.unknownContributors} without a contributor ref`}
          </p>
          <p className="hint">Records, threads and contributors are counted separately so that one busy thread or person is visible.</p>
        </div>
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Exclusions ({excluded.length})</h2>
          {reasons.length === 0 ? (
            <p className="hint">None.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
              {reasons.map(([k, n]) => (
                <li key={k}>
                  {EXCLUSION_LABEL[k as Exclusion] ?? k}: <span className="num">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
