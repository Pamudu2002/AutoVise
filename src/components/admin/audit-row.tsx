"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/format";

export function AuditRow({ row }: { row: { id: string; at: string; who: string; action: string; entity: string; entityId: string | null; before: unknown; after: unknown } }) {
  const [open, setOpen] = useState(false);
  const has = row.before !== null || row.after !== null;
  return (
    <>
      <tr>
        <td className="tnum" style={{ whiteSpace: "nowrap" }}>
          {fmtDateTime(row.at)}
        </td>
        <td>{row.who}</td>
        <td>
          <span className="chip num">{row.action}</span>
        </td>
        <td>
          {row.entity}
          {row.entityId && (
            <span className="num muted" style={{ fontSize: 11, marginLeft: 6 }}>
              {row.entityId.slice(0, 8)}
            </span>
          )}
        </td>
        <td className="r">
          {has && (
            <button className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? "Hide" : "Show"}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ background: "var(--subtle)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 12 }}>
              {(["before", "after"] as const).map((k) => (
                <div key={k} style={{ minWidth: 0 }}>
                  <span className="eyebrow">{k}</span>
                  <pre style={{ margin: "6px 0 0", fontSize: 11.5, fontFamily: "var(--mono)", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 280, overflow: "auto" }}>
                    {row[k] === null ? "—" : JSON.stringify(row[k], null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
