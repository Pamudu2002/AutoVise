"use client";

import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { resolveDispute, submitCheck } from "@/lib/actions/evidence";
import { EXCLUSION_LABEL, QA_FIELDS, type CodingStatus, type Exclusion, type QaField } from "@/lib/evidence/types";

export interface QaRecord {
  id: string;
  recordCode: string;
  entity: string;
  text: string;
  translationEn: string | null;
  themes: string[];
  sentiment: string | null;
  switching: boolean;
  switchingNote: string | null;
  included: boolean;
  exclusionReason: string | null;
  codingStatus: CodingStatus;
  codedBy: string | null;
  codedByName: string | null;
  checkedByName: string | null;
  checkFields: Partial<Record<QaField, "agree" | "disagree">> | null;
  checkNote: string | null;
}

const FIELD_LABEL: Record<QaField, string> = { themes: "Themes", sentiment: "Sentiment", switching: "Switching", inclusion: "Inclusion" };

/** A second person reviews the coding field by field. The coder cannot check their own record. */
export function QaCard({ record, me, canWrite }: { record: QaRecord; me: string; canWrite: boolean }) {
  const { exec, pending } = useAction();
  const [fields, setFields] = useState<Record<QaField, "agree" | "disagree">>({ themes: "agree", sentiment: "agree", switching: "agree", inclusion: "agree" });
  const [note, setNote] = useState("");
  const own = record.codedBy === me;
  const shown: Record<QaField, string> = {
    themes: record.themes.join(", ") || "None",
    sentiment: record.sentiment ?? "—",
    switching: record.switching ? `Yes${record.switchingNote ? ` — ${record.switchingNote}` : ""}` : "No",
    inclusion: record.included ? "Included" : `Excluded (${EXCLUSION_LABEL[record.exclusionReason as Exclusion] ?? "—"})`,
  };

  return (
    <article className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }} aria-label={`QA ${record.recordCode}`}>
      <header style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
        <strong className="num">{record.recordCode}</strong>
        <span>{record.entity}</span>
        <span style={{ color: "var(--muted)" }}>· coded by {record.codedByName ?? "—"}</span>
        <div style={{ flex: 1 }} />
        {record.codingStatus === "checked" && <span className="pill pill-approved">Checked by {record.checkedByName ?? "—"}</span>}
        {record.codingStatus === "disputed" && <span className="pill pill-failed">Disputed</span>}
        {record.codingStatus === "coded" && <span className="pill pill-review">Waiting for check</span>}
      </header>
      <blockquote style={{ margin: 0, padding: "10px 14px", borderLeft: "3px solid var(--border-strong)", background: "var(--subtle)", borderRadius: 6, fontSize: 14 }}>
        {record.text}
        {record.translationEn && <span style={{ display: "block", marginTop: 6, color: "var(--muted)" }}>Translation: {record.translationEn}</span>}
      </blockquote>
      <div className="tbl-box">
        <table className="tbl">
          <thead>
            <tr>
              <th>Field</th>
              <th>Coding</th>
              <th style={{ width: 200 }}>{record.codingStatus === "coded" ? "Your check" : "Check"}</th>
            </tr>
          </thead>
          <tbody>
            {QA_FIELDS.map((f) => (
              <tr key={f}>
                <td style={{ fontWeight: 500 }}>{FIELD_LABEL[f]}</td>
                <td style={{ fontSize: 13 }}>{shown[f]}</td>
                <td>
                  {record.codingStatus === "coded" ? (
                    <div className="seg" role="radiogroup" aria-label={`${FIELD_LABEL[f]} check`}>
                      {(["agree", "disagree"] as const).map((v) => (
                        <button key={v} type="button" role="radio" aria-checked={fields[f] === v} className={`seg-btn${fields[f] === v ? " on" : ""}`} disabled={!canWrite || own} onClick={() => setFields({ ...fields, [f]: v })}>
                          {v === "agree" ? "Agree" : "Disagree"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: record.checkFields?.[f] === "disagree" ? "var(--neg)" : "var(--pos)" }}>{record.checkFields?.[f] === "disagree" ? "Disagree" : record.checkFields?.[f] ? "Agree" : "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {record.checkNote && record.codingStatus !== "coded" && <p style={{ fontSize: 13, color: "var(--muted)" }}>Note: {record.checkNote}</p>}

      {canWrite && record.codingStatus === "coded" && (
        own ? (
          <p className="hint">You coded this record, so another team member has to check it.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input className="input" aria-label="Check note" placeholder={Object.values(fields).includes("disagree") ? "Explain the disagreement (required)" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />
            <div>
              <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => exec(() => submitCheck(record.id, { fields, note: note || null }))}>
                Submit check
              </button>
            </div>
          </div>
        )
      )}
      {canWrite && record.codingStatus === "disputed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="hint">Fix the coding on the Records tab if needed, then record how the team settled it.</p>
          <input className="input" aria-label="Resolution" placeholder="How the disagreement was resolved" value={note} onChange={(e) => setNote(e.target.value)} />
          <div>
            <button className="btn btn-secondary btn-sm" disabled={pending || !note.trim()} onClick={() => exec(() => resolveDispute(record.id, note))}>
              Mark resolved
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
