"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { refreshQaSample } from "@/lib/actions/evidence";
import type { FieldAgreement } from "@/lib/evidence/agreement";
import { QA_FIELDS, type QaField } from "@/lib/evidence/types";
import { QaCard, type QaRecord } from "./qa-card";

const FIELD_LABEL: Record<QaField | "overall", string> = { overall: "Overall", themes: "Themes", sentiment: "Sentiment", switching: "Switching", inclusion: "Inclusion" };

export function QaBoard({
  studyId,
  records,
  agreement,
  rate,
  eligible,
  me,
  canWrite,
}: {
  studyId: string;
  records: QaRecord[];
  agreement: Record<QaField | "overall", FieldAgreement>;
  rate: number;
  eligible: number;
  me: string;
  canWrite: boolean;
}) {
  const { exec, pending } = useAction();
  const [tab, setTab] = useState<"open" | "disputed" | "checked">("open");
  const groups = {
    open: records.filter((r) => r.codingStatus === "coded"),
    disputed: records.filter((r) => r.codingStatus === "disputed"),
    checked: records.filter((r) => r.codingStatus === "checked"),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 2 }}>
          <strong>
            QA sample: <span className="num">{records.length}</span> of <span className="num">{eligible}</span> coded records
          </strong>
          <span className="hint">
            A seeded, stratified sample of about {Math.round(rate * 100)}% per operator (at least two each), plus every record cited by a finding. A second person checks each one.
          </span>
        </div>
        {canWrite && (
          <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec(() => refreshQaSample(studyId))}>
            <RefreshCw size={14} aria-hidden />
            Update sample
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {(["overall", ...QA_FIELDS] as const).map((f) => (
          <div key={f} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{FIELD_LABEL[f]} agreement</span>
            <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
              {agreement[f].pct === null ? "—" : `${agreement[f].pct}%`}
            </span>
            <span className="hint num">
              {agreement[f].agree} / {agreement[f].total}
            </span>
          </div>
        ))}
      </div>
      <div className="seg" role="tablist" aria-label="QA status" style={{ alignSelf: "flex-start" }}>
        {(
          [
            ["open", "To check"],
            ["disputed", "Disputed"],
            ["checked", "Checked"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`seg-btn${tab === k ? " on" : ""}`} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label} <span className="num">{groups[k].length}</span>
          </button>
        ))}
      </div>
      {groups[tab].length === 0 ? (
        <div className="card" style={{ padding: "40px 24px", textAlign: "center", color: "var(--muted)" }}>
          {tab === "open" ? (records.length ? "Every record in the sample has been checked." : "No sample yet. Code some records, then update the sample.") : "None."}
        </div>
      ) : (
        groups[tab].map((r) => <QaCard key={`${r.id}-${r.codingStatus}`} record={r} me={me} canWrite={canWrite} />)
      )}
    </div>
  );
}
