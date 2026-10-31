"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { Select } from "@/components/ui/fields";
import { acceptCoding, rejectSuggestion } from "@/lib/actions/evidence";
import type { EvidenceCoding } from "@/lib/ai/schemas";
import { EXCLUSION_LABEL, EXCLUSIONS, PLATFORM_LABEL, PRODUCT_LABEL, PRODUCTS, SENTIMENTS, type Exclusion, type Platform, type Product, type Sentiment } from "@/lib/evidence/types";

export interface CodingRecord {
  id: string;
  recordCode: string;
  entity: string;
  requiresGeoCheck: boolean;
  geoConfirmed: boolean;
  platform: Platform;
  product: Product;
  productEvidence: string | null;
  text: string;
  language: string;
  translationEn: string | null;
  themeKeys: string[];
  sentiment: Sentiment | null;
  switching: boolean;
  switchingNote: string | null;
  suggestion: (EvidenceCoding & { model?: string }) | null;
}

const FLAG_TO_EXCLUSION: Record<keyof EvidenceCoding["flags"], Exclusion> = {
  advert: "advert",
  hearsay: "hearsay",
  not_first_hand: "not_first_hand",
  overseas: "overseas",
  irrelevant: "irrelevant",
};

/** One record to code. AI suggestions are pre-filled but nothing counts until a person accepts. */
export function CodingCard({ record, themes, canWrite }: { record: CodingRecord; themes: { key: string; label: string; description: string | null }[]; canWrite: boolean }) {
  const { exec, pending } = useAction();
  const s = record.suggestion;
  const flagged = s ? (Object.keys(s.flags) as (keyof EvidenceCoding["flags"])[]).filter((k) => s.flags[k]) : [];
  const [c, setC] = useState({
    themeKeys: s ? s.themes.filter((k) => themes.some((t) => t.key === k)) : record.themeKeys,
    sentiment: (s?.sentiment ?? record.sentiment ?? "unclear") as Sentiment,
    switching: s?.switching.value ?? record.switching,
    switchingNote: s?.switching.explanation ?? record.switchingNote ?? "",
    product: (s && record.product === "unclear" ? s.product_guess : record.product) as Product,
    productEvidence: record.productEvidence ?? s?.product_evidence_quote ?? "",
    translationEn: record.translationEn ?? s?.translation_en ?? "",
    included: flagged.length === 0 && (!record.requiresGeoCheck || record.geoConfirmed),
    exclusionReason: (flagged[0] ? FLAG_TO_EXCLUSION[flagged[0]] : record.requiresGeoCheck && !record.geoConfirmed ? "overseas" : "") as Exclusion | "",
  });

  return (
    <article className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }} aria-label={`Record ${record.recordCode}`}>
      <header style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
        <strong className="num">{record.recordCode}</strong>
        <span>{record.entity}</span>
        <span style={{ color: "var(--muted)" }}>
          · {PLATFORM_LABEL[record.platform]} · {PRODUCT_LABEL[record.product]}
        </span>
        <div style={{ flex: 1 }} />
        {s ? (
          <span className="pill pill-processing">
            <Sparkles size={12} aria-hidden /> AI suggestion{s.model ? ` · ${s.model}` : ""} · confidence {Math.round(s.confidence * 100)}%
          </span>
        ) : (
          <span className="pill pill-draft">Uncoded</span>
        )}
      </header>
      <blockquote style={{ margin: 0, padding: "10px 14px", borderLeft: "3px solid var(--border-strong)", background: "var(--subtle)", borderRadius: 6, fontSize: 14 }}>{record.text}</blockquote>
      {record.language !== "en" && (
        <div className="field">
          <label className="label" htmlFor={`tr-${record.id}`}>
            English translation
          </label>
          <textarea id={`tr-${record.id}`} className="textarea" rows={2} value={c.translationEn} onChange={(e) => setC({ ...c, translationEn: e.target.value })} disabled={!canWrite} />
        </div>
      )}
      {flagged.length > 0 && (
        <div className="warn-chip" role="note" style={{ height: "auto", padding: "6px 10px", alignSelf: "flex-start" }}>
          AI flagged: {flagged.map((f) => EXCLUSION_LABEL[FLAG_TO_EXCLUSION[f]]).join(", ")}
        </div>
      )}
      <fieldset disabled={!canWrite || pending} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <legend className="sr-only">Coding</legend>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Themes">
          {themes.map((t) => {
            const on = c.themeKeys.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                title={t.description ?? undefined}
                className="chip chip-btn"
                aria-pressed={on}
                style={on ? { background: "var(--primary-soft)", color: "var(--primary-text)", borderColor: "transparent" } : undefined}
                onClick={() => setC({ ...c, themeKeys: on ? c.themeKeys.filter((k) => k !== t.key) : [...c.themeKeys, t.key] })}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "end" }}>
          <div className="field">
            <label className="label" htmlFor={`se-${record.id}`}>
              Sentiment
            </label>
            <Select id={`se-${record.id}`} value={c.sentiment} onChange={(e) => setC({ ...c, sentiment: e.target.value as Sentiment })}>
              {SENTIMENTS.map((x) => (
                <option key={x} value={x}>
                  {x[0].toUpperCase() + x.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label className="label" htmlFor={`pr-${record.id}`}>
              Product
            </label>
            <Select id={`pr-${record.id}`} value={c.product} onChange={(e) => setC({ ...c, product: e.target.value as Product })}>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14, height: 40 }}>
            <input type="checkbox" className="check" checked={c.switching} onChange={(e) => setC({ ...c, switching: e.target.checked })} />
            Switching / second connection
          </label>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14, height: 40 }}>
            <input type="checkbox" className="check" checked={c.included} onChange={(e) => setC({ ...c, included: e.target.checked, exclusionReason: e.target.checked ? "" : c.exclusionReason })} />
            Include
          </label>
        </div>
        {c.product === "air_fibre" && (
          <div className="field">
            <label className="label" htmlFor={`pe-${record.id}`}>
              Product evidence (words naming Air Fibre)
            </label>
            <input id={`pe-${record.id}`} className="input" value={c.productEvidence} onChange={(e) => setC({ ...c, productEvidence: e.target.value })} />
          </div>
        )}
        {c.switching && (
          <div className="field">
            <label className="label" htmlFor={`sw-${record.id}`}>
              Switching explanation
            </label>
            <input id={`sw-${record.id}`} className="input" value={c.switchingNote} onChange={(e) => setC({ ...c, switchingNote: e.target.value })} />
          </div>
        )}
        {!c.included && (
          <div className="field" style={{ maxWidth: 260 }}>
            <label className="label" htmlFor={`ex-${record.id}`}>
              Exclusion reason
            </label>
            <Select id={`ex-${record.id}`} value={c.exclusionReason} onChange={(e) => setC({ ...c, exclusionReason: e.target.value as Exclusion })}>
              <option value="">Choose…</option>
              {EXCLUSIONS.map((x) => (
                <option key={x} value={x}>
                  {EXCLUSION_LABEL[x]}
                </option>
              ))}
            </Select>
          </div>
        )}
        {record.requiresGeoCheck && !record.geoConfirmed && <p className="hint">{record.entity} records must be confirmed as Sri Lankan experiences (edit the record) before they can be included.</p>}
        {canWrite && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                exec(() =>
                  acceptCoding(record.id, {
                    ...c,
                    switchingNote: c.switching ? c.switchingNote || null : null,
                    productEvidence: c.productEvidence || null,
                    translationEn: c.translationEn || null,
                    exclusionReason: c.included ? null : c.exclusionReason || null,
                  }),
                )
              }
            >
              {s ? "Accept coding" : "Save coding"}
            </button>
            {s && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => exec(() => rejectSuggestion(record.id))}>
                Discard suggestion
              </button>
            )}
          </div>
        )}
      </fieldset>
    </article>
  );
}
