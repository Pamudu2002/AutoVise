"use client";

import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { Select } from "@/components/ui/fields";
import { saveScreening } from "@/lib/actions/evidence";
import { PLATFORM_LABEL, PLATFORMS, type Platform } from "@/lib/evidence/types";
import { fmtDate } from "@/lib/format";

interface Row {
  platform: Platform;
  decision: "pending" | "selected" | "excluded";
  reason: string;
  searchTerms: string;
  sortMethod: string;
  coverageNote: string;
  screenedBy: string | null;
  screenedAt: string | null;
}

const PILL = { pending: "pill-draft", selected: "pill-approved", excluded: "pill-failed" } as const;

/** Platform screening (PLAN2 §7.2): one row per platform with the decision and its reason. URLs are never fetched. */
export function ScreeningTable({ studyId, rows, canWrite }: { studyId: string; rows: Row[]; canWrite: boolean }) {
  const { exec, pending } = useAction();
  const all: Row[] = PLATFORMS.map((p) => rows.find((r) => r.platform === p) ?? { platform: p, decision: "pending", reason: "", searchTerms: "", sortMethod: "", coverageNote: "", screenedBy: null, screenedAt: null });
  const [edit, setEdit] = useState<Record<string, Row>>({});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {all.map((r0) => {
        const r = edit[r0.platform] ?? r0;
        const dirty = !!edit[r0.platform];
        const put = (patch: Partial<Row>) => setEdit({ ...edit, [r0.platform]: { ...r, ...patch } });
        return (
          <fieldset key={r.platform} className="card" disabled={!canWrite} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, margin: 0 }}>
            <legend className="sr-only">{PLATFORM_LABEL[r.platform]}</legend>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{PLATFORM_LABEL[r.platform]}</h2>
              <span className={`pill ${PILL[r.decision]}`}>{r.decision === "pending" ? "Not screened" : r.decision === "selected" ? "Selected" : "Excluded"}</span>
              {r0.screenedAt && (
                <span className="hint">
                  {r0.screenedBy ?? "—"} · {fmtDate(r0.screenedAt)}
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div className="field">
                <label className="label" htmlFor={`d-${r.platform}`}>
                  Decision
                </label>
                <Select id={`d-${r.platform}`} value={r.decision} onChange={(e) => put({ decision: e.target.value as Row["decision"] })}>
                  <option value="pending">Not screened</option>
                  <option value="selected">Selected</option>
                  <option value="excluded">Excluded</option>
                </Select>
              </div>
              <div className="field">
                <label className="label" htmlFor={`r-${r.platform}`}>
                  Reason {r.decision !== "pending" && <span style={{ color: "var(--neg)" }}>*</span>}
                </label>
                <input id={`r-${r.platform}`} className="input" value={r.reason} onChange={(e) => put({ reason: e.target.value })} placeholder="Why this platform is in or out of scope" />
              </div>
            </div>
            {r.decision !== "excluded" && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 12 }}>
                <div className="field">
                  <label className="label" htmlFor={`t-${r.platform}`}>
                    Search terms (one per line)
                  </label>
                  <textarea id={`t-${r.platform}`} className="textarea" rows={3} value={r.searchTerms} onChange={(e) => put({ searchTerms: e.target.value })} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="field">
                    <label className="label" htmlFor={`s-${r.platform}`}>
                      Sort method
                    </label>
                    <input id={`s-${r.platform}`} className="input" value={r.sortMethod} onChange={(e) => put({ sortMethod: e.target.value })} placeholder="e.g. Newest first" />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`c-${r.platform}`}>
                      Coverage note
                    </label>
                    <input id={`c-${r.platform}`} className="input" value={r.coverageNote} onChange={(e) => put({ coverageNote: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
            {canWrite && dirty && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={pending}
                  onClick={async () => {
                    const res = await exec(() =>
                      saveScreening(studyId, r.platform, {
                        decision: r.decision,
                        reason: r.reason || null,
                        searchTerms: r.searchTerms.split("\n"),
                        sortMethod: r.sortMethod || null,
                        coverageNote: r.coverageNote || null,
                      }),
                    );
                    if (res.ok) {
                      const next = { ...edit };
                      delete next[r.platform];
                      setEdit(next);
                    }
                  }}
                >
                  Save decision
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const next = { ...edit };
                    delete next[r.platform];
                    setEdit(next);
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
