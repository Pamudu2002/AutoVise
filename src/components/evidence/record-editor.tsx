"use client";

import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { Drawer } from "@/components/ui/dialog";
import { FieldError, Select } from "@/components/ui/fields";
import { saveEvidenceRecord } from "@/lib/actions/evidence";
import { EXCLUSION_LABEL, EXCLUSIONS, LANGUAGE_LABEL, LANGUAGES, PLATFORM_LABEL, PLATFORMS, PRODUCT_LABEL, PRODUCTS, SENTIMENTS, type Exclusion, type Language, type Platform, type Product, type Sentiment } from "@/lib/evidence/types";

export interface EditableRecord {
  id: string | null;
  recordCode: string;
  platform: Platform;
  sourceUrl: string;
  postedAt: string;
  collectionDate: string;
  threadId: string;
  contributorRef: string;
  starRating: string;
  entityId: string;
  product: Product;
  productEvidence: string;
  geoConfirmed: boolean;
  text: string;
  language: Language;
  translationEn: string;
  sentiment: Sentiment | "";
  switching: boolean;
  switchingNote: string;
  themeKeys: string[];
  included: boolean;
  exclusionReason: Exclusion | "";
  inclusionNote: string;
}

export const blankRecord = (entityId: string, collectionDate: string): EditableRecord => ({
  id: null,
  recordCode: "",
  platform: "google_play",
  sourceUrl: "",
  postedAt: "",
  collectionDate,
  threadId: "",
  contributorRef: "",
  starRating: "",
  entityId,
  product: "mobile",
  productEvidence: "",
  geoConfirmed: false,
  text: "",
  language: "en",
  translationEn: "",
  sentiment: "",
  switching: false,
  switchingNote: "",
  themeKeys: [],
  included: true,
  exclusionReason: "",
  inclusionNote: "",
});

const two = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 } as const;

/** Add or edit one record by hand. Usernames never go in; contributor refs are team codes. */
export function RecordEditor({
  studyId,
  record,
  onClose,
  entities,
  themes,
  canWrite,
}: {
  studyId: string;
  record: EditableRecord | null;
  onClose: () => void;
  entities: { id: string; name: string; group: string; requiresGeoCheck: boolean }[];
  themes: { key: string; label: string }[];
  canWrite: boolean;
}) {
  const { exec, pending, error } = useAction();
  const [r, setR] = useState<EditableRecord | null>(record);
  const [seen, setSeen] = useState(record);
  if (record !== seen) {
    setSeen(record);
    setR(record);
  }
  if (!r) return null;
  const set = <K extends keyof EditableRecord>(k: K, v: EditableRecord[K]) => setR({ ...r, [k]: v });
  const entity = entities.find((e) => e.id === r.entityId);

  const save = async () => {
    const res = await exec(() =>
      saveEvidenceRecord(studyId, r.id, {
        recordCode: r.recordCode || undefined,
        platform: r.platform,
        sourceUrl: r.sourceUrl,
        postedAt: r.postedAt || null,
        collectionDate: r.collectionDate || null,
        threadId: r.threadId,
        contributorRef: r.contributorRef,
        starRating: r.starRating ? Number(r.starRating) : null,
        entityId: r.entityId,
        product: r.product,
        productEvidence: r.productEvidence,
        geoConfirmed: r.geoConfirmed,
        text: r.text,
        language: r.language,
        translationEn: r.translationEn,
        sentiment: r.sentiment || null,
        switching: r.switching,
        switchingNote: r.switchingNote,
        themeKeys: r.themeKeys,
        included: r.included,
        exclusionReason: r.included ? null : r.exclusionReason || null,
        inclusionNote: r.inclusionNote,
      }),
    );
    if (res.ok) onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={640}
      title={r.id ? `Record ${r.recordCode}` : "New record"}
      subtitle="Paste only the relevant text or a paraphrase. Remove names, handles and contact details."
      footer={
        canWrite ? (
          <>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={pending}>
              Save record
            </button>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!canWrite} style={{ display: "flex", flexDirection: "column", gap: 14, border: 0, padding: "20px 24px", margin: 0 }}>
        <div style={two}>
          <div className="field">
            <label className="label" htmlFor="r-entity">
              Operator
            </label>
            <Select id="r-entity" value={r.entityId} onChange={(e) => set("entityId", e.target.value)}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.group} · {e.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label className="label" htmlFor="r-product">
              Service / product
            </label>
            <Select id="r-product" value={r.product} onChange={(e) => set("product", e.target.value as Product)}>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {r.product === "air_fibre" && (
          <div className="field">
            <label className="label" htmlFor="r-pe">
              Product evidence (words from the source that name Air Fibre)
            </label>
            <input id="r-pe" className="input" value={r.productEvidence} onChange={(e) => set("productEvidence", e.target.value)} />
          </div>
        )}
        <div style={two}>
          <div className="field">
            <label className="label" htmlFor="r-platform">
              Platform
            </label>
            <Select id="r-platform" value={r.platform} onChange={(e) => set("platform", e.target.value as Platform)}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label className="label" htmlFor="r-url">
              Source URL (reference only)
            </label>
            <input id="r-url" className="input" value={r.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="r-posted">
              Posted
            </label>
            <input id="r-posted" type="date" className="input num" value={r.postedAt} onChange={(e) => set("postedAt", e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="r-thread">
              Thread ID
            </label>
            <input id="r-thread" className="input" value={r.threadId} onChange={(e) => set("threadId", e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="r-contrib">
              Contributor ref
            </label>
            <input id="r-contrib" className="input num" value={r.contributorRef} onChange={(e) => set("contributorRef", e.target.value)} placeholder="T03-C2" />
          </div>
          <div className="field">
            <label className="label" htmlFor="r-stars">
              Stars
            </label>
            <Select id="r-stars" value={r.starRating} onChange={(e) => set("starRating", e.target.value)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {entity?.requiresGeoCheck && (
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" className="check" checked={r.geoConfirmed} onChange={(e) => set("geoConfirmed", e.target.checked)} />
            Confirmed as a Sri Lankan experience
          </label>
        )}
        <div className="field">
          <label className="label" htmlFor="r-text">
            Relevant text or paraphrase
          </label>
          <textarea id="r-text" className="textarea" rows={4} value={r.text} onChange={(e) => set("text", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "160px minmax(0, 1fr)", gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="r-lang">
              Language
            </label>
            <Select id="r-lang" value={r.language} onChange={(e) => set("language", e.target.value as Language)}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABEL[l]}
                </option>
              ))}
            </Select>
          </div>
          {r.language !== "en" && (
            <div className="field">
              <label className="label" htmlFor="r-tr">
                English translation
              </label>
              <textarea id="r-tr" className="textarea" rows={2} value={r.translationEn} onChange={(e) => set("translationEn", e.target.value)} />
            </div>
          )}
        </div>
        <div className="field">
          <span className="label">Themes</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {themes.map((t) => {
              const on = r.themeKeys.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  className="chip chip-btn"
                  aria-pressed={on}
                  style={on ? { background: "var(--primary-soft)", color: "var(--primary-text)", borderColor: "transparent" } : undefined}
                  onClick={() => set("themeKeys", on ? r.themeKeys.filter((k) => k !== t.key) : [...r.themeKeys, t.key])}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={two}>
          <div className="field">
            <label className="label" htmlFor="r-sent">
              Sentiment
            </label>
            <Select id="r-sent" value={r.sentiment} onChange={(e) => set("sentiment", e.target.value as Sentiment | "")}>
              <option value="">Not coded</option>
              {SENTIMENTS.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div className="field">
            <span className="label">Switching</span>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14, height: 40 }}>
              <input type="checkbox" className="check" checked={r.switching} onChange={(e) => set("switching", e.target.checked)} />
              Changed provider or keeps a second connection
            </label>
          </div>
        </div>
        {r.switching && (
          <div className="field">
            <label className="label" htmlFor="r-swn">
              Switching explanation
            </label>
            <input id="r-swn" className="input" value={r.switchingNote} onChange={(e) => set("switchingNote", e.target.value)} />
          </div>
        )}
        <div style={two}>
          <div className="field">
            <span className="label">Inclusion</span>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14, height: 40 }}>
              <input type="checkbox" className="check" checked={r.included} onChange={(e) => set("included", e.target.checked)} />
              Included in the analysis
            </label>
          </div>
          {!r.included && (
            <div className="field">
              <label className="label" htmlFor="r-excl">
                Exclusion reason
              </label>
              <Select id="r-excl" value={r.exclusionReason} onChange={(e) => set("exclusionReason", e.target.value as Exclusion | "")}>
                <option value="">Choose…</option>
                {EXCLUSIONS.map((x) => (
                  <option key={x} value={x}>
                    {EXCLUSION_LABEL[x]}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="r-note">
            Inclusion / exclusion note
          </label>
          <input id="r-note" className="input" value={r.inclusionNote} onChange={(e) => set("inclusionNote", e.target.value)} />
        </div>
        <FieldError>{error}</FieldError>
      </fieldset>
    </Drawer>
  );
}
