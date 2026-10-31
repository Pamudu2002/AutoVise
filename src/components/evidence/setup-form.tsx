"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { FieldError, Select } from "@/components/ui/fields";
import { deleteEvidenceEntity, deleteEvidenceTarget, saveEvidenceEntity, saveEvidenceGroup, saveEvidenceTarget, saveStudySetup } from "@/lib/actions/evidence";
import { LANGUAGE_LABEL, LANGUAGES, PLATFORM_LABEL, PLATFORMS, PRODUCT_LABEL, PRODUCTS, REPORT_SECTIONS, SECTION_LABEL, type Language, type Platform, type Product, type ReportSection } from "@/lib/evidence/types";

interface Setup {
  title: string;
  collectionDate: string;
  windowMonths: number;
  languages: Language[];
  languageLimitations: string;
  minNForPercent: number;
  qaRate: number;
  notes: string;
  limitations: string;
  questions: { id?: string; question: string; reportSection: ReportSection }[];
  themes: { id?: string; key: string; label: string; description: string; investmentRelevance: string }[];
}
interface Group {
  id: string;
  name: string;
  entities: { id: string; name: string; isSubject: boolean; requiresGeoCheck: boolean }[];
}
interface Target {
  id?: string;
  label: string;
  groupId: string | null;
  product: Product | null;
  platform: Platform | null;
  perEntity: boolean;
  targetMin: number;
  targetMax: number;
}

const section = { display: "flex", flexDirection: "column", gap: 14, padding: 20 } as const;
const grid = (cols: string) => ({ display: "grid", gridTemplateColumns: cols, gap: 12 }) as const;

export function SetupForm({ studyId, initial, groups, targets, canWrite }: { studyId: string; initial: Setup; groups: Group[]; targets: Target[]; canWrite: boolean }) {
  const { exec, pending, error } = useAction();
  const [s, setS] = useState(initial);
  const [newEntity, setNewEntity] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState("");
  const [tg, setTg] = useState<Target[]>(targets);
  const set = <K extends keyof Setup>(k: K, v: Setup[K]) => setS((p) => ({ ...p, [k]: v }));

  const save = () => exec(() => saveStudySetup(studyId, { ...s, languageLimitations: s.languageLimitations || null, notes: s.notes || null, limitations: s.limitations || null }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <fieldset className="card" style={section} disabled={!canWrite}>
        <legend className="sr-only">Study details</legend>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Study</h2>
        <div className="field">
          <label className="label" htmlFor="s-title">
            Title
          </label>
          <input id="s-title" className="input" value={s.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div style={grid("repeat(auto-fit, minmax(160px, 1fr))")}>
          <div className="field">
            <label className="label" htmlFor="s-date">
              Collection date
            </label>
            <input id="s-date" type="date" className="input num" value={s.collectionDate} onChange={(e) => set("collectionDate", e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="s-win">
              Window (months)
            </label>
            <input id="s-win" type="number" min={1} max={36} className="input num" value={s.windowMonths} onChange={(e) => set("windowMonths", Number(e.target.value))} />
          </div>
          <div className="field">
            <label className="label" htmlFor="s-minn">
              Minimum n for percentages
            </label>
            <input id="s-minn" type="number" min={5} className="input num" value={s.minNForPercent} onChange={(e) => set("minNForPercent", Number(e.target.value))} />
          </div>
          <div className="field">
            <label className="label" htmlFor="s-qa">
              QA sample rate
            </label>
            <input id="s-qa" type="number" min={0.05} max={1} step={0.05} className="input num" value={s.qaRate} onChange={(e) => set("qaRate", Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <span className="label">Languages the team can interpret</span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {LANGUAGES.map((l) => (
              <label key={l} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" className="check" checked={s.languages.includes(l)} onChange={(e) => set("languages", e.target.checked ? [...s.languages, l] : s.languages.filter((x) => x !== l))} />
                {LANGUAGE_LABEL[l]}
              </label>
            ))}
          </div>
          <span className="hint">Records in other languages stay uncoded unless they carry an English translation.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="s-ll">
            Language limitations
          </label>
          <textarea id="s-ll" className="textarea" rows={2} value={s.languageLimitations} onChange={(e) => set("languageLimitations", e.target.value)} placeholder="e.g. Sinhala and Tamil posts were collected only where a team member could translate them." />
        </div>
        <div className="field">
          <label className="label" htmlFor="s-lim">
            Study-specific limitations (one per line)
          </label>
          <textarea id="s-lim" className="textarea" rows={3} value={s.limitations} onChange={(e) => set("limitations", e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="s-notes">
            Team notes (not public)
          </label>
          <textarea id="s-notes" className="textarea" rows={3} value={s.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="card" style={section} disabled={!canWrite}>
        <legend className="sr-only">Research questions</legend>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Research questions</h2>
        <p className="hint">Each question maps to a pitch section. Up to three approved findings per question.</p>
        {s.questions.map((q, i) => (
          <div key={q.id ?? `new-${i}`} style={grid("minmax(0, 1fr) 200px auto")}>
            <input className="input" aria-label={`Question ${i + 1}`} value={q.question} onChange={(e) => set("questions", s.questions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
            <Select aria-label={`Pitch section for question ${i + 1}`} value={q.reportSection} onChange={(e) => set("questions", s.questions.map((x, j) => (j === i ? { ...x, reportSection: e.target.value as ReportSection } : x)))}>
              {REPORT_SECTIONS.map((r) => (
                <option key={r} value={r}>
                  {SECTION_LABEL[r]}
                </option>
              ))}
            </Select>
            <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove question ${i + 1}`} onClick={() => set("questions", s.questions.filter((_, j) => j !== i))}>
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => set("questions", [...s.questions, { question: "", reportSection: "other" }])}>
            <Plus size={14} aria-hidden />
            Add question
          </button>
        </div>
      </fieldset>

      <fieldset className="card" style={section} disabled={!canWrite}>
        <legend className="sr-only">Themes</legend>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Themes</h2>
        <p className="hint">The coding frame. Keys are fixed identifiers used in imports (e.g. price_value).</p>
        {s.themes.map((t, i) => (
          <div key={t.id ?? `new-${i}`} style={grid("140px minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr) auto")}>
            <input className="input num" aria-label="Theme key" value={t.key} onChange={(e) => set("themes", s.themes.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
            <input className="input" aria-label="Theme label" value={t.label} onChange={(e) => set("themes", s.themes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <input className="input" aria-label="Theme description" placeholder="What counts" value={t.description} onChange={(e) => set("themes", s.themes.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <input className="input" aria-label="Investment relevance" placeholder="Investment relevance" value={t.investmentRelevance} onChange={(e) => set("themes", s.themes.map((x, j) => (j === i ? { ...x, investmentRelevance: e.target.value } : x)))} />
            <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove theme ${t.label}`} onClick={() => set("themes", s.themes.filter((_, j) => j !== i))}>
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => set("themes", [...s.themes, { key: "", label: "", description: "", investmentRelevance: "" }])}>
            <Plus size={14} aria-hidden />
            Add theme
          </button>
        </div>
      </fieldset>

      {canWrite && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn btn-primary" onClick={save} disabled={pending}>
            Save setup
          </button>
          <FieldError>{error}</FieldError>
        </div>
      )}

      <section className="card" style={section}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Comparison groups</h2>
        <p className="hint">Entities are only compared within their group. Mark the subject company, and entities whose records must be confirmed as Sri Lankan experiences.</p>
        {groups.map((g) => (
          <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <strong>{g.name}</strong>
            {g.entities.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
                <span style={{ minWidth: 220 }}>{e.name}</span>
                <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" className="check" disabled={!canWrite || pending} checked={e.isSubject} onChange={(ev) => exec(() => saveEvidenceEntity(studyId, { ...e, groupId: g.id, isSubject: ev.target.checked }))} />
                  Subject
                </label>
                <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" className="check" disabled={!canWrite || pending} checked={e.requiresGeoCheck} onChange={(ev) => exec(() => saveEvidenceEntity(studyId, { ...e, groupId: g.id, requiresGeoCheck: ev.target.checked }))} />
                  Needs Sri Lankan check
                </label>
                {canWrite && (
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${e.name}`} onClick={() => confirm(`Remove ${e.name}?`) && exec(() => deleteEvidenceEntity(studyId, e.id))}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {canWrite && (
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" style={{ maxWidth: 280 }} aria-label={`New entity in ${g.name}`} placeholder="Add entity" value={newEntity[g.id] ?? ""} onChange={(e) => setNewEntity({ ...newEntity, [g.id]: e.target.value })} />
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pending || !newEntity[g.id]?.trim()}
                  onClick={async () => {
                    const r = await exec(() => saveEvidenceEntity(studyId, { groupId: g.id, name: newEntity[g.id], isSubject: false, requiresGeoCheck: false }));
                    if (r.ok) setNewEntity({ ...newEntity, [g.id]: "" });
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}
        {canWrite && (
          <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <input className="input" style={{ maxWidth: 280 }} aria-label="New group" placeholder="New comparison group" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
            <button
              className="btn btn-secondary btn-sm"
              disabled={pending || !newGroup.trim()}
              onClick={async () => {
                const r = await exec(() => saveEvidenceGroup(studyId, { name: newGroup }));
                if (r.ok) setNewGroup("");
              }}
            >
              Add group
            </button>
          </div>
        )}
      </section>

      <section className="card" style={section}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Collection targets</h2>
        <p className="hint">Practical guides for the team, not quotas that make the sample representative.</p>
        {tg.map((t, i) => (
          <fieldset key={t.id ?? `new-${i}`} disabled={!canWrite} style={{ ...grid("minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 90px 70px 70px auto"), alignItems: "center", border: 0, padding: 0, margin: 0 }}>
            <input className="input" aria-label="Target label" value={t.label} onChange={(e) => setTg(tg.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Select aria-label="Group" value={t.groupId ?? ""} onChange={(e) => setTg(tg.map((x, j) => (j === i ? { ...x, groupId: e.target.value || null } : x)))}>
              <option value="">Any group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Product" value={t.product ?? ""} onChange={(e) => setTg(tg.map((x, j) => (j === i ? { ...x, product: (e.target.value || null) as Product | null } : x)))}>
              <option value="">Any product</option>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABEL[p]}
                </option>
              ))}
            </Select>
            <Select aria-label="Platform" value={t.platform ?? ""} onChange={(e) => setTg(tg.map((x, j) => (j === i ? { ...x, platform: (e.target.value || null) as Platform | null } : x)))}>
              <option value="">Any platform</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </Select>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" className="check" checked={t.perEntity} onChange={(e) => setTg(tg.map((x, j) => (j === i ? { ...x, perEntity: e.target.checked } : x)))} />
              Per entity
            </label>
            <input className="input num" type="number" aria-label="Minimum" value={t.targetMin} onChange={(e) => setTg(tg.map((x, j) => (j === i ? { ...x, targetMin: Number(e.target.value) } : x)))} />
            <input className="input num" type="number" aria-label="Maximum" value={t.targetMax} onChange={(e) => setTg(tg.map((x, j) => (j === i ? { ...x, targetMax: Number(e.target.value) } : x)))} />
            <span style={{ display: "inline-flex", gap: 4 }}>
              <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec(() => saveEvidenceTarget(studyId, t))}>
                Save
              </button>
              {t.id && (
                <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove target ${t.label}`} onClick={() => exec(() => deleteEvidenceTarget(studyId, t.id!))}>
                  <Trash2 size={14} aria-hidden />
                </button>
              )}
            </span>
          </fieldset>
        ))}
        {canWrite && (
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTg([...tg, { label: "", groupId: null, product: null, platform: null, perEntity: false, targetMin: 10, targetMax: 20 }])}>
              <Plus size={14} aria-hidden />
              Add target
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
