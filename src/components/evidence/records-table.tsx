"use client";

import { Download, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { Select, SearchInput } from "@/components/ui/fields";
import { dismissDuplicate, embedRecordsNow, markDuplicate, setPublicExample } from "@/lib/actions/evidence";
import { CODING_STATUSES, EXCLUSION_LABEL, PLATFORM_LABEL, PRODUCT_LABEL, type CodingStatus, type Exclusion } from "@/lib/evidence/types";
import { blankRecord, RecordEditor, type EditableRecord } from "./record-editor";

export interface RecordRow extends EditableRecord {
  id: string;
  codingStatus: CodingStatus;
  inQaSample: boolean;
  publicExample: boolean;
  hasEmbedding: boolean;
}

const STATUS_LABEL: Record<CodingStatus, string> = { uncoded: "Uncoded", ai_suggested: "AI suggestion", coded: "Coded", checked: "Checked", disputed: "Disputed" };
const STATUS_PILL: Record<CodingStatus, string> = { uncoded: "pill-draft", ai_suggested: "pill-processing", coded: "pill-uploaded", checked: "pill-approved", disputed: "pill-failed" };

export function RecordsTable({
  studyId,
  rows,
  entities,
  themes,
  duplicates,
  collectionDate,
  canWrite,
  canApprove,
  initialView,
}: {
  studyId: string;
  rows: RecordRow[];
  entities: { id: string; name: string; group: string; requiresGeoCheck: boolean }[];
  themes: { key: string; label: string }[];
  duplicates: { a: string; b: string; similarity: number; method: string }[];
  collectionDate: string;
  canWrite: boolean;
  canApprove: boolean;
  initialView: "records" | "duplicates";
}) {
  const { exec, pending } = useAction();
  const [view, setView] = useState(initialView);
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");
  const [status, setStatus] = useState("all");
  const [incl, setIncl] = useState("all");
  const [edit, setEdit] = useState<EditableRecord | null>(null);
  const entityName = Object.fromEntries(entities.map((e) => [e.id, e.name]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const missingEmbeddings = rows.filter((r) => r.included && !r.hasEmbedding).length;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (entity === "all" || r.entityId === entity) &&
        (status === "all" || r.codingStatus === status) &&
        (incl === "all" || (incl === "in" ? r.included : !r.included)) &&
        (!needle || r.recordCode.toLowerCase().includes(needle) || r.text.toLowerCase().includes(needle) || r.translationEn.toLowerCase().includes(needle)),
    );
  }, [rows, q, entity, status, incl]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className="seg" role="tablist" aria-label="View">
          <button className={`seg-btn${view === "records" ? " on" : ""}`} role="tab" aria-selected={view === "records"} onClick={() => setView("records")}>
            Records <span className="num">{rows.length}</span>
          </button>
          <button className={`seg-btn${view === "duplicates" ? " on" : ""}`} role="tab" aria-selected={view === "duplicates"} onClick={() => setView("duplicates")}>
            Possible duplicates <span className="num">{duplicates.length}</span>
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <a className="btn btn-secondary btn-sm" href={`/api/evidence/${studyId}/export`}>
          <Download size={14} aria-hidden />
          Export CSV
        </a>
        {canWrite && (
          <>
            <Link className="btn btn-secondary btn-sm" href={`/admin/evidence/${studyId}/records/import`}>
              <Upload size={14} aria-hidden />
              Import spreadsheet
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => setEdit(blankRecord(entities[0]?.id ?? "", collectionDate))} disabled={!entities.length}>
              <Plus size={14} aria-hidden />
              Add record
            </button>
          </>
        )}
      </div>

      {view === "records" ? (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ width: 240 }}>
              <SearchInput aria-label="Search records" placeholder="Search text or ID" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div style={{ width: 220 }}>
              <Select aria-label="Operator" value={entity} onChange={(e) => setEntity(e.target.value)}>
                <option value="all">All operators</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.group} · {e.name}
                  </option>
                ))}
              </Select>
            </div>
            <div style={{ width: 170 }}>
              <Select aria-label="Coding status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">Any status</option>
                {CODING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div style={{ width: 150 }}>
              <Select aria-label="Inclusion" value={incl} onChange={(e) => setIncl(e.target.value)}>
                <option value="all">All</option>
                <option value="in">Included</option>
                <option value="out">Excluded</option>
              </Select>
            </div>
          </div>
          {list.length === 0 ? (
            <div className="card" style={{ padding: "40px 24px", textAlign: "center", color: "var(--muted)" }}>
              {rows.length ? "No records match these filters." : "No records yet. Import the team's collection spreadsheet or add records by hand."}
            </div>
          ) : (
            <div className="tbl-box">
              <table className="tbl" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Operator</th>
                    <th>Platform · product</th>
                    <th>Text</th>
                    <th>Themes</th>
                    <th>Status</th>
                    <th>Inclusion</th>
                    {canApprove && <th>Appendix example</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button className="link-btn num" onClick={() => setEdit(r)}>
                          {r.recordCode}
                        </button>
                        {r.inQaSample && (
                          <span className="chip" style={{ marginLeft: 6, height: 20, fontSize: 11 }}>
                            QA
                          </span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{entityName[r.entityId] ?? "—"}</td>
                      <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                        {PLATFORM_LABEL[r.platform]}
                        <br />
                        <span style={{ color: "var(--muted)" }}>{PRODUCT_LABEL[r.product]}</span>
                      </td>
                      <td style={{ maxWidth: 380, fontSize: 13 }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.translationEn || r.text}</span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.themeKeys.map((k) => themes.find((t) => t.key === k)?.label ?? k).join(", ") || "—"}</td>
                      <td>
                        <span className={`pill ${STATUS_PILL[r.codingStatus]}`}>{STATUS_LABEL[r.codingStatus]}</span>
                      </td>
                      <td style={{ fontSize: 13 }}>{r.included ? "Included" : <span style={{ color: "var(--muted)" }}>Excluded · {EXCLUSION_LABEL[r.exclusionReason as Exclusion] ?? "—"}</span>}</td>
                      {canApprove && (
                        <td>
                          <input
                            type="checkbox"
                            className="check"
                            aria-label={`Show ${r.recordCode} as an example in the public appendix`}
                            checked={r.publicExample}
                            disabled={pending || !r.included || r.codingStatus !== "checked"}
                            onChange={(e) => exec(() => setPublicExample(r.id, e.target.checked))}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hint">Only included records that passed the QA check can be shown as paraphrased examples in the public appendix.</p>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="hint" style={{ fontSize: 14 }}>
            Pairs of included records with near-identical text (embedding similarity ≥ 0.92, or word overlap when embeddings are missing). Mark the later one as a duplicate, or dismiss the pair.
            {missingEmbeddings > 0 && ` ${missingEmbeddings} included record${missingEmbeddings === 1 ? " has" : "s have"} no embedding yet.`}
          </p>
          {canWrite && missingEmbeddings > 0 && (
            <div>
              <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec(() => embedRecordsNow(studyId), { success: "Embeddings updated." })}>
                Compute embeddings now
              </button>
            </div>
          )}
          {duplicates.length === 0 ? (
            <div className="card" style={{ padding: "32px 24px", textAlign: "center", color: "var(--muted)" }}>
              No possible duplicates.
            </div>
          ) : (
            duplicates.map((d) => {
              const a = byId.get(d.a);
              const b = byId.get(d.b);
              if (!a || !b) return null;
              const [first, second] = a.recordCode < b.recordCode ? [a, b] : [b, a];
              return (
                <div key={`${d.a}-${d.b}`} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                    <span>
                      Similarity <span className="num">{d.similarity.toFixed(2)}</span> ({d.method === "embedding" ? "embeddings" : "word overlap"})
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[first, second].map((r) => (
                      <div key={r.id} style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                        <strong className="num">
                          {r.recordCode} · {entityName[r.entityId]} · {PLATFORM_LABEL[r.platform]}
                        </strong>
                        <span>{r.translationEn || r.text}</span>
                      </div>
                    ))}
                  </div>
                  {canWrite && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec(() => markDuplicate(second.id, first.id))}>
                        Mark {second.recordCode} as duplicate of {first.recordCode}
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => exec(() => dismissDuplicate(studyId, d.a, d.b))}>
                        Not a duplicate
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <RecordEditor studyId={studyId} record={edit} onClose={() => setEdit(null)} entities={entities} themes={themes} canWrite={canWrite} />
    </div>
  );
}
