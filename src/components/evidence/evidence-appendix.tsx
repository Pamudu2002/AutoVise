import type { AppendixData } from "@/lib/evidence/appendix";
import { fmtDate } from "@/lib/format";
import { ThemeMatrix } from "./theme-matrix";

const h2 = { fontSize: 18, fontWeight: 600 } as const;
const sectionStyle = { display: "flex", flexDirection: "column", gap: 10 } as const;

export interface AppendixFinding {
  question: string;
  text: string;
  support: string;
}

/**
 * The methodology appendix (PLAN2 §7.6): questions, platforms and search terms, the sample, the theme
 * matrix, approved findings, limitations and a few paraphrased examples. No usernames, contributor
 * refs or links to individual posts.
 */
export function EvidenceAppendix({ data, findings }: { data: AppendixData; findings: AppendixFinding[] }) {
  const selected = data.platforms.filter((p) => p.decision === "selected");
  const excluded = data.platforms.filter((p) => p.decision === "excluded");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <section style={sectionStyle}>
        <h2 style={h2}>About this study</h2>
        <p style={{ fontSize: 15, lineHeight: 1.6 }}>
          An exploratory review of public, first-hand customer accounts collected on {fmtDate(data.collectionDate)}, covering posts from {fmtDate(data.windowStart)} onwards ({data.windowMonths} months). It included{" "}
          <strong className="num">{data.totals.included}</strong> records and excluded <strong className="num">{data.totals.excluded}</strong> (adverts, hearsay, duplicates, out-of-window or overseas accounts, and similar). The findings add context to the
          investment case. They do not change the price prediction.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2}>Research questions</h2>
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 15 }}>
          {data.questions.map((q) => (
            <li key={q.question}>
              {q.question} <span style={{ color: "var(--muted)", fontSize: 13 }}>({q.section})</span>
            </li>
          ))}
        </ol>
      </section>

      {findings.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={h2}>Approved findings</h2>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10, fontSize: 15, lineHeight: 1.55 }}>
            {findings.map((f) => (
              <li key={f.text}>
                {f.text}
                <span style={{ display: "block", fontSize: 13, color: "var(--muted)" }}>
                  {f.support[0].toUpperCase() + f.support.slice(1)}: {f.question}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={sectionStyle}>
        <h2 style={h2}>Platforms and search terms</h2>
        <div className="tbl-box">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Why</th>
                <th>Search terms</th>
                <th>Sort</th>
              </tr>
            </thead>
            <tbody>
              {selected.map((p) => (
                <tr key={p.platform}>
                  <td style={{ fontWeight: 500 }}>{p.platform}</td>
                  <td style={{ fontSize: 13 }}>
                    {p.reason ?? "—"}
                    {p.coverageNote && <span style={{ display: "block", color: "var(--muted)" }}>{p.coverageNote}</span>}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 360 }}>{p.searchTerms.join(" · ") || "—"}</td>
                  <td style={{ fontSize: 13 }}>{p.sortMethod ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {excluded.length > 0 && (
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            Not used: {excluded.map((p) => `${p.platform}${p.reason ? ` (${p.reason})` : ""}`).join("; ")}.
          </p>
        )}
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Languages interpreted: {data.languages.join(", ")}. Records were collected by hand; links to individual posts are kept by the research team and not published.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2}>Sample</h2>
        <div className="tbl-box">
          <table className="tbl">
            <thead>
              <tr>
                <th>Group</th>
                <th>Entity</th>
                <th>Platform</th>
                <th className="r">Records</th>
                <th className="r">Threads</th>
                <th className="r">Contributors</th>
              </tr>
            </thead>
            <tbody>
              {data.sample.map((s) => (
                <tr key={`${s.entity}-${s.platform}`}>
                  <td>{s.group}</td>
                  <td>{s.entity}</td>
                  <td>{s.platform}</td>
                  <td className="r num">{s.records}</td>
                  <td className="r num">{s.threads}</td>
                  <td className="r num">{s.contributors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2}>Theme matrix</h2>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Counts are out of the included, coded records for each entity. Percentages appear only where an entity has at least {data.matrix.minNForPercent} records.
        </p>
        <ThemeMatrix matrix={data.matrix} themes={data.themes} />
      </section>

      {data.examples.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={h2}>Example accounts</h2>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>Paraphrased or shortened; names and contact details removed.</p>
          {data.examples.map((e) => (
            <figure key={e.text} style={{ margin: 0, padding: "12px 16px", borderLeft: "3px solid var(--border-strong)", background: "var(--subtle)", borderRadius: 6 }}>
              <blockquote style={{ margin: 0, fontSize: 15 }}>“{e.text}”</blockquote>
              <figcaption style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                {e.entity} · {e.platform}
                {e.month ? ` · ${e.month}` : ""}
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      <section style={sectionStyle}>
        <h2 style={h2}>Limitations</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.5 }}>
          {data.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
