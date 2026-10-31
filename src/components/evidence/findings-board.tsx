"use client";

import { Check, CircleAlert, Pencil, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { Select } from "@/components/ui/fields";
import { acknowledgeWarning, approveFinding, draftFindings, rejectFinding, saveFinding } from "@/lib/actions/evidence";
import { SECTION_LABEL, SUPPORTS, type ReportSection, type Support } from "@/lib/evidence/types";
import { fmtDate } from "@/lib/format";

export interface FindingRow {
  id: string;
  questionId: string | null;
  text: string;
  support: Support;
  citedCodes: string[];
  citedNotReady: string[];
  warnings: { code: string; message: string; phrase: string; acknowledged?: boolean }[];
  status: "draft" | "approved" | "rejected";
  generatedBy: string;
  approvedByName: string | null;
  approvedAt: string | null;
}

interface Question {
  id: string;
  question: string;
  section: ReportSection;
}

const SUPPORT_LABEL: Record<Support, string> = { supports: "Supports", contradicts: "Contradicts", explains: "Explains", qualifies: "Qualifies" };

function Editor({ studyId, questionId, initial, onDone }: { studyId: string; questionId: string; initial?: FindingRow; onDone: () => void }) {
  const { exec, pending } = useAction();
  const [text, setText] = useState(initial?.text ?? "");
  const [support, setSupport] = useState<Support>(initial?.support ?? "explains");
  const [codes, setCodes] = useState(initial?.citedCodes.join(", ") ?? "");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "var(--subtle)", borderRadius: 10 }}>
      <div className="field">
        <label className="label" htmlFor={`f-text-${initial?.id ?? questionId}`}>
          Finding
        </label>
        <textarea id={`f-text-${initial?.id ?? questionId}`} className="textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="In this exploratory sample, 6 of 20 … app reviews describe …" />
        <span className="hint">Describe what the collected records show, with the denominator. No claims about most customers, churn, market share or losses.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor={`f-sup-${initial?.id ?? questionId}`}>
            Relation to the question
          </label>
          <Select id={`f-sup-${initial?.id ?? questionId}`} value={support} onChange={(e) => setSupport(e.target.value as Support)}>
            {SUPPORTS.map((s) => (
              <option key={s} value={s}>
                {SUPPORT_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="field">
          <label className="label" htmlFor={`f-codes-${initial?.id ?? questionId}`}>
            Cited records
          </label>
          <input id={`f-codes-${initial?.id ?? questionId}`} className="input num" value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="R004, R017" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={pending}
          onClick={async () => {
            const res = await exec(() => saveFinding(studyId, { id: initial?.id, questionId, text, support, citedCodes: codes.split(/[\s,;]+/).filter(Boolean) }));
            if (res.ok) onDone();
          }}
        >
          Save and check
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function FindingCard({ studyId, f, canWrite, canApprove }: { studyId: string; f: FindingRow; canWrite: boolean; canApprove: boolean }) {
  const { exec, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const open = f.warnings.filter((w) => !w.acknowledged);
  if (editing && f.questionId) return <Editor studyId={studyId} questionId={f.questionId} initial={f} onDone={() => setEditing(false)} />;
  const blocked = open.length > 0 || f.citedNotReady.length > 0 || !f.citedCodes.length;

  return (
    <article className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, opacity: f.status === "rejected" ? 0.6 : 1 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <span className={`pill ${f.status === "approved" ? "pill-approved" : f.status === "rejected" ? "pill-superseded" : "pill-review"}`}>{f.status === "approved" ? "Approved" : f.status === "rejected" ? "Rejected" : "Draft"}</span>
        <span className="chip">{SUPPORT_LABEL[f.support]}</span>
        <span style={{ color: "var(--muted)" }}>{f.generatedBy === "ai" ? "AI draft" : "Written by the team"}</span>
        {f.approvedByName && (
          <span style={{ color: "var(--muted)" }}>
            · approved by {f.approvedByName}
            {f.approvedAt ? `, ${fmtDate(f.approvedAt)}` : ""}
          </span>
        )}
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.5 }}>{f.text}</p>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        Cites{" "}
        {f.citedCodes.length ? (
          f.citedCodes.map((c) => (
            <span key={c} className="chip num" style={{ marginRight: 4, height: 20, fontSize: 11, ...(f.citedNotReady.includes(c) ? { background: "var(--warn-soft)", color: "var(--warn)" } : {}) }}>
              {c}
            </span>
          ))
        ) : (
          <em>nothing</em>
        )}
        {f.citedNotReady.length > 0 && <span style={{ color: "var(--warn)" }}> · {f.citedNotReady.join(", ")} not yet checked in QA</span>}
      </p>
      {f.warnings.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }} aria-label="Guard warnings">
          {f.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: w.acknowledged ? "var(--muted)" : "var(--warn)" }}>
              {w.acknowledged ? <Check size={14} aria-hidden style={{ marginTop: 2 }} /> : <CircleAlert size={14} aria-hidden style={{ marginTop: 2 }} />}
              <span style={{ flex: 1 }}>
                {w.message} <span style={{ color: "var(--muted)" }}>“{w.phrase}”</span>
                {w.acknowledged && " (acknowledged)"}
              </span>
              {!w.acknowledged && canApprove && f.status === "draft" && w.code !== "citation" && (
                <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => exec(() => acknowledgeWarning(f.id, i))}>
                  Acknowledge
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {f.status !== "rejected" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {f.status === "draft" && canWrite && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden />
              Edit
            </button>
          )}
          {f.status === "draft" && canApprove && (
            <button className="btn btn-primary btn-sm" disabled={pending || blocked} onClick={() => exec(() => approveFinding(f.id))} title={blocked ? "Resolve the warnings and get every cited record checked first" : undefined}>
              <Check size={14} aria-hidden />
              Approve
            </button>
          )}
          {canApprove && (
            <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => exec(() => rejectFinding(f.id))}>
              <X size={14} aria-hidden />
              {f.status === "approved" ? "Withdraw" : "Reject"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function FindingsBoard({ studyId, questions, findings, canWrite, canApprove, checkedCount }: { studyId: string; questions: Question[]; findings: FindingRow[]; canWrite: boolean; canApprove: boolean; checkedCount: number }) {
  const { exec, pending } = useAction();
  const [adding, setAdding] = useState<string | null>(null);
  const [caveats, setCaveats] = useState<Record<string, string[]>>({});
  const [showRejected, setShowRejected] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p className="hint" style={{ fontSize: 14 }}>
        At most three findings per research question. Each must cite records that are included and checked in QA, and pass the claim guard. Approved findings are attached to the pitch word for word with an “exploratory customer evidence” caveat. They never change the valuation.
      </p>
      {checkedCount === 0 && <p className="warn-chip" style={{ height: "auto", padding: "8px 12px" }}>No records have passed QA yet, so nothing can be cited. Check the QA sample first.</p>}
      <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input type="checkbox" className="check" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} />
        Show rejected findings
      </label>
      {questions.map((q, i) => {
        const list = findings.filter((f) => f.questionId === q.id && (showRejected || f.status !== "rejected"));
        const active = findings.filter((f) => f.questionId === q.id && f.status !== "rejected").length;
        return (
          <section key={q.id} style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-labelledby={`q-${q.id}`}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="eyebrow">
                  Question {i + 1} · {SECTION_LABEL[q.section]}
                </span>
                <h2 id={`q-${q.id}`} style={{ fontSize: 16, fontWeight: 600 }}>
                  {q.question}
                </h2>
              </div>
              {canWrite && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={pending || checkedCount === 0}
                    onClick={async () => {
                      const res = await exec(() => draftFindings(studyId, q.id), { success: "Draft findings ready for review." });
                      if (res.ok && res.data) setCaveats({ ...caveats, [q.id]: res.data.caveats });
                    }}
                  >
                    <Sparkles size={14} aria-hidden />
                    Draft with AI
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={active >= 3} onClick={() => setAdding(q.id)}>
                    <Plus size={14} aria-hidden />
                    Write finding
                  </button>
                </div>
              )}
            </div>
            {caveats[q.id]?.length ? (
              <ul className="hint" style={{ margin: 0, paddingLeft: 18 }}>
                {caveats[q.id].map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
            {adding === q.id && <Editor studyId={studyId} questionId={q.id} onDone={() => setAdding(null)} />}
            {list.length === 0 && adding !== q.id ? (
              <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                No findings yet.
              </div>
            ) : (
              list.map((f) => <FindingCard key={`${f.id}-${f.status}-${f.text.length}`} studyId={studyId} f={f} canWrite={canWrite} canApprove={canApprove} />)
            )}
          </section>
        );
      })}
    </div>
  );
}
