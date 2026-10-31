import type { Matrix, MatrixCell } from "@/lib/evidence/matrix";
import { FAMILY_LABEL, PLATFORM_LABEL } from "@/lib/evidence/types";

const SENT_COLOR = { negative: "var(--neg)", mixed: "var(--warn)", positive: "var(--pos)", unclear: "var(--border-strong)" } as const;

function SentimentBar({ cell }: { cell: MatrixCell }) {
  if (!cell.count) return null;
  const parts = (["negative", "mixed", "positive", "unclear"] as const).filter((k) => cell.sentiment[k] > 0);
  const label = parts.map((k) => `${cell.sentiment[k]} ${k}`).join(", ");
  return (
    <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", marginTop: 4, width: 72 }} role="img" aria-label={label} title={label}>
      {parts.map((k) => (
        <span key={k} style={{ flex: cell.sentiment[k], background: SENT_COLOR[k] }} />
      ))}
    </div>
  );
}

/**
 * Theme matrix, one table per comparison group × platform × product family. Counts always carry
 * their denominator; percentages only above the small-sample threshold. No totals across entities.
 */
export function ThemeMatrix({ matrix, themes }: { matrix: Matrix; themes: { key: string; label: string }[] }) {
  if (!matrix.blocks.length) return <p className="hint">No included, coded records yet.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {matrix.blocks.map((b) => (
        <section key={`${b.groupId}-${b.platform}-${b.family}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>
            {b.groupName} · {PLATFORM_LABEL[b.platform]} · {FAMILY_LABEL[b.family]}
          </h3>
          <div className="tbl-box">
            <table className="tbl" style={{ minWidth: 200 + b.entities.length * 160 }}>
              <thead>
                <tr>
                  <th>Theme</th>
                  {b.entities.map((e) => (
                    <th key={e.entityId} className="r" style={{ whiteSpace: "normal" }}>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>
                        {e.entityName}
                        {e.isSubject && " ★"}
                      </span>
                      <br />
                      <span className="num">
                        n = {e.n} · {e.threads} thread{e.threads === 1 ? "" : "s"} · {e.contributors} contributor{e.contributors === 1 ? "" : "s"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {themes.map((t) => (
                  <tr key={t.key}>
                    <td style={{ fontWeight: 500 }}>{t.label}</td>
                    {b.entities.map((e) => {
                      const c = e.cells[t.key] ?? { count: 0, sentiment: { positive: 0, mixed: 0, negative: 0, unclear: 0 }, pct: null };
                      return (
                        <td key={e.entityId} className="r">
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                            <span className="num">
                              {c.count} of {e.n}
                              {c.pct !== null && <span style={{ color: "var(--muted)" }}> ({c.pct}%)</span>}
                            </span>
                            <SentimentBar cell={c} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="hint">
        ★ subject company. Bars show sentiment within the theme (red negative, amber mixed, green positive, grey unclear). Each table stands alone: app reviews and service experiences, and different platforms, are never pooled or ranked.
      </p>
    </div>
  );
}
