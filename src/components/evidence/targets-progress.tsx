import type { TargetProgress } from "@/lib/evidence/targets";

const TONE = { below: "var(--warn)", within: "var(--pos)", above: "var(--info)" } as const;

/** Practical collection targets (not statistically representative) with progress per row. */
export function TargetsProgress({ progress, entityName }: { progress: TargetProgress[]; entityName: Record<string, string> }) {
  if (!progress.length) return <p className="hint">No targets set. Add them in Setup.</p>;
  return (
    <div className="tbl-box">
      <table className="tbl">
        <thead>
          <tr>
            <th>Target</th>
            <th>Entity</th>
            <th className="r">Included records</th>
            <th className="r">Target</th>
            <th style={{ width: 200 }}>Progress</th>
          </tr>
        </thead>
        <tbody>
          {progress.flatMap((t) =>
            t.rows.map((r, i) => (
              <tr key={`${t.targetId}-${r.entityId ?? i}`}>
                <td>{i === 0 ? t.label : ""}</td>
                <td>{r.entityId ? (entityName[r.entityId] ?? "—") : "All"}</td>
                <td className="r num">{r.count}</td>
                <td className="r num">{r.min === r.max ? r.min : `${r.min}–${r.max}`}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--subtle-2)", overflow: "hidden" }} aria-hidden>
                      <div style={{ width: `${Math.min(100, (r.count / Math.max(1, r.min)) * 100)}%`, height: "100%", background: TONE[r.status] }} />
                    </div>
                    <span style={{ fontSize: 12, color: TONE[r.status], minWidth: 48 }}>{r.status === "below" ? "Below" : r.status === "within" ? "Met" : "Above"}</span>
                  </div>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
