"use client";

import { ArrowRight, Eye, MessageSquarePlus, RotateCcw, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { CompanyLogo } from "@/components/company-logo";
import { Dialog } from "@/components/ui/dialog";
import { StatusPill, UpsideBadge } from "@/components/ui/figures";
import { addOverrideNote, publishPredictionAction, rerunPrediction } from "@/lib/actions/predictions";
import { fmtDate, money, multiple, num, pct, signedPct } from "@/lib/format";
import type { LogoBg, LogoShape } from "@/lib/logo-tile";
import { toHundred } from "@/lib/valuation/qualitative";
import { FACTOR_KEYS, FACTOR_LABELS, type Assumptions, type FactorScore, type OverrideNote, type ScenarioSet } from "@/lib/valuation/types";

export interface PredictionSummary {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  basePrice: number;
  currency: string;
  scenarios: ScenarioSet;
  confidence: number;
  autoviseScore: number;
  assumptions: Assumptions;
  factorScores: FactorScore[];
  trigger: string | null;
  modelVersion: string;
  overrideNotes: OverrideNote[];
  createdAt: string;
  publishedAt: string | null;
}

export interface CompanyPredictions {
  company: { id: string; slug: string; name: string; ticker: string; logoUrl: string | null; logoDarkUrl: string | null; logoBg: LogoBg; logoShape: LogoShape; brandColor: string | null; currency: string; price: number | null };
  draft: PredictionSummary | null;
  published: PredictionSummary | null;
  history: { version: number; base: number; publishedAt: string | null; createdAt: string }[];
}

type Row = { name: string; old: string | null; now: string; changed: boolean; why: string };

function compareRows(d: PredictionSummary, p: PredictionSummary | null): Row[] {
  const a = d.assumptions;
  const b = p?.assumptions;
  const f = (s: FactorScore[] | undefined, k: string) => s?.find((x) => x.key === k);
  const row = (name: string, now: string, old: string | null | undefined, why = ""): Row => ({ name, now, old: old ?? null, changed: old !== undefined && old !== null && old !== now, why });
  const rows: Row[] = [
    row("Price used", money(d.basePrice, d.currency), p ? money(p.basePrice, p.currency) : null, "Latest close when the prediction was built"),
    row(`Base EPS (FY${a.epsYear ?? "—"})`, money(a.eps0, d.currency), b ? money(b.eps0, d.currency) : null, b && b.epsYear !== a.epsYear ? `New full-year figures (FY${a.epsYear})` : ""),
    row("EPS growth, first year", pct(a.growth.blended), b ? pct(b.growth.blended) : null, `Record ${pct(a.growth.historical)}, sustainable ${pct(a.growth.sustainable)}, sector ${pct(a.growth.sector)}`),
    row("Exit P/E", multiple(a.exitPe.final), b ? multiple(b.exitPe.final) : null, `Today ${multiple(a.pe0)}, sector ${multiple(a.sector.pe)}`),
    row(
      "DCF value, year 3",
      a.methods?.dcf != null && a.methods.weights.dcf > 0 ? `${money(a.methods.dcf, d.currency)} · ${pct(a.methods.weights.dcf, 0)}` : "Not used",
      b ? (b.methods?.dcf != null && b.methods.weights.dcf > 0 ? `${money(b.methods.dcf, d.currency)} · ${pct(b.methods.weights.dcf, 0)}` : "Not used") : null,
      a.dcf ? `Cash conversion ${pct(a.dcf.fcfConversion)}, cost of equity ${pct(a.dcf.costOfEquity)}` : "",
    ),
    row("Qualitative tilt", signedPct(a.qualitative.tiltPct), b ? signedPct(b.qualitative.tiltPct) : null, `Composite ${toHundred(a.qualitative.composite)}/100`),
    row("Debt / equity input", a.ratios.debtToEquity === null ? "n/a" : num(a.ratios.debtToEquity), b ? (b.ratios.debtToEquity === null ? "n/a" : num(b.ratios.debtToEquity)) : null),
    ...FACTOR_KEYS.map((k) => {
      const now = f(d.factorScores, k);
      const old = p ? f(p.factorScores, k) : undefined;
      return row(`${FACTOR_LABELS[k]} score`, String(toHundred(now?.score ?? 0)), old ? String(toHundred(old.score)) : p ? "50" : null, now?.justification ?? "");
    }),
  ];
  return rows.map((r) => ({ ...r, why: r.changed || !p ? r.why : "" }));
}

/** Predictions (Predictions.dc.html): company list on the left, draft-vs-published comparison on the right. */
export function PredictionsAdmin({ list, selected, canPublish, minConfidence }: { list: CompanyPredictions[]; selected: string | null; canPublish: boolean; minConfidence: number }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const cur = list.find((l) => l.company.slug === selected) ?? null;
  const drafts = list.filter((l) => l.draft).length;
  const shown = cur?.draft ?? cur?.published ?? null;
  const old = cur?.draft ? cur.published : null;
  const cmp = shown
    ? [
        { label: "Bear case", o: old?.scenarios.bear.y3, n: shown.scenarios.bear.y3, money: true },
        { label: "Base case · 3 yr", o: old?.scenarios.base.y3, n: shown.scenarios.base.y3, money: true },
        { label: "Bull case", o: old?.scenarios.bull.y3, n: shown.scenarios.bull.y3, money: true },
        { label: "Confidence", o: old?.confidence, n: shown.confidence, money: false },
        { label: "AutoVise Score", o: old?.autoviseScore, n: shown.autoviseScore, money: false },
      ]
    : [];
  const rows = shown ? compareRows(shown, old) : [];
  const lowConfidence = !!cur?.draft && cur.draft.confidence < minConfidence;
  const notes = [...(cur?.published?.overrideNotes ?? []), ...(cur?.draft?.overrideNotes ?? [])];

  return (
    <div style={{ padding: 24, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", maxWidth: 1400, width: "100%" }}>
      <section className="card" style={{ flex: "1 1 280px", maxWidth: 340, display: "flex", flexDirection: "column" }} aria-label="Predictions">
        <div style={{ padding: "16px 16px 12px", display: "flex", flexDirection: "column", gap: 4, borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Predictions</h1>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{drafts ? `${drafts} draft${drafts === 1 ? "" : "s"} waiting for review` : "Nothing waiting for review"}</span>
        </div>
        <ul style={{ margin: 0, padding: 6, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
          {list.map((l) => {
            const on = l.company.slug === selected;
            const status = l.draft ? "draft" : l.published ? "published" : "pending";
            const sub = l.draft
              ? `${l.published ? num(l.published.scenarios.base.y3) + " → " : ""}${num(l.draft.scenarios.base.y3)}`
              : l.published
                ? `${num(l.published.scenarios.base.y3)} · ${fmtDate(l.published.publishedAt).slice(0, 6)}`
                : "Waiting for reports";
            return (
              <li key={l.company.id}>
                <button
                  onClick={() => router.replace(`/admin/predictions?company=${l.company.slug}`, { scroll: false })}
                  aria-pressed={on}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px", borderRadius: 9, border: 0, background: on ? "var(--primary-soft)" : "transparent", color: "var(--text)", cursor: "pointer", font: "inherit", textAlign: "left" }}
                >
                  <CompanyLogo {...l.company} size={32} decorative />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{l.company.ticker}</span>
                    <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
                      {sub}
                    </span>
                  </span>
                  <StatusPill status={status === "pending" ? "draft" : status} label={status === "pending" ? "Pending" : undefined} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section style={{ flex: "999 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
        {!cur ? (
          <p className="hint">No companies yet.</p>
        ) : (
          <>
            <div className="card" style={{ padding: 20, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 600 }}>{cur.company.name}</h2>
                  {shown ? <StatusPill status={shown.status} label={shown.status === "draft" ? "Draft · needs review" : undefined} /> : <span className="pill pill-draft">Pending</span>}
                </div>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  {cur.draft && cur.published
                    ? `Draft v${cur.draft.version} compared with published v${cur.published.version} (${fmtDate(cur.published.publishedAt)})`
                    : cur.draft
                      ? `Draft v${cur.draft.version} · first prediction for this company`
                      : cur.published
                        ? `Published v${cur.published.version} on ${fmtDate(cur.published.publishedAt)} · no newer draft`
                        : "No prediction yet — approve an annual report to create one."}
                </span>
                {shown?.trigger && (
                  <span style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <Zap size={14} aria-hidden />
                    Triggered by: {shown.trigger}, {fmtDate(shown.createdAt)}
                  </span>
                )}
                {shown && <span style={{ fontSize: 12, color: "var(--muted)" }}>Model: {shown.modelVersion}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {shown && (
                  <Link className="btn btn-ghost" href={`/companies/${cur.company.slug}${cur.draft ? `?preview=${cur.draft.id}` : ""}`} target="_blank">
                    <Eye size={16} aria-hidden />
                    {cur.draft ? "Preview pitch" : "View pitch"}
                  </Link>
                )}
                {shown && (
                  <button className="btn btn-ghost" onClick={() => setNoteOpen(true)}>
                    <MessageSquarePlus size={16} aria-hidden />
                    Add override note
                  </button>
                )}
                <button className="btn btn-secondary" disabled={pending} onClick={() => exec(() => rerunPrediction(cur.company.id))}>
                  <RotateCcw size={16} aria-hidden />
                  Rerun
                </button>
                {canPublish && (
                  <button className="btn btn-primary" disabled={!cur.draft || pending || lowConfidence} onClick={() => setConfirm(true)} title={lowConfidence ? `Confidence below ${minConfidence}` : undefined}>
                    Publish
                  </button>
                )}
              </div>
              {lowConfidence && (
                <div role="status" style={{ flexBasis: "100%", padding: "10px 12px", borderRadius: 10, background: "var(--warn-soft)", fontSize: 13 }}>
                  Confidence {cur.draft!.confidence} is below the minimum of {minConfidence} to publish (Settings). The company stays as Pending on the public site.
                </div>
              )}
            </div>

            {shown && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: 16 }}>
                  {cmp.map((c) => (
                    <div key={c.label} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.label}</span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        {c.o !== undefined && c.o !== null && (
                          <>
                            <span className="num" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "line-through" }}>
                              {c.money ? num(c.o) : c.o}
                            </span>
                            <ArrowRight size={14} style={{ color: "var(--muted)" }} aria-hidden />
                          </>
                        )}
                        <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>
                          {c.money ? num(c.n) : c.n}
                        </span>
                      </div>
                      {c.o !== undefined && c.o !== null ? (
                        c.money ? (
                          <UpsideBadge value={c.n / c.o - 1} label={`${c.label} change`} />
                        ) : (
                          <span className={`delta ${c.n > c.o ? "up" : c.n < c.o ? "down" : "flat"}`}>{c.n === c.o ? "No change" : `${c.n > c.o ? "+" : "−"}${Math.abs(c.n - c.o)}`}</span>
                        )
                      ) : c.money ? (
                        <span className="hint">{cur.company.price ? `${signedPct(c.n / cur.company.price - 1)} vs today` : ""}</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <section className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>Assumptions</h3>
                    {old && (
                      <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--warn-soft)", border: "1px solid var(--warn-mark)" }} />
                        Changed in this draft
                      </span>
                    )}
                  </div>
                  <div className="tbl-box" style={{ borderRadius: 10 }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Assumption</th>
                          {old && <th className="r">Published</th>}
                          <th className="r">{old ? "Draft" : shown.status === "draft" ? "Draft" : "Published"}</th>
                          <th>{old ? "Why it changed" : "Basis"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.name} className={r.changed ? "changed" : undefined}>
                            <td style={{ fontWeight: 500 }}>{r.name}</td>
                            {old && <td className="r num muted">{r.old ?? "—"}</td>}
                            <td className="r num" style={{ fontWeight: 600 }}>
                              {r.now}
                            </td>
                            <td style={{ fontSize: 13, color: "var(--muted)" }}>{r.why}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {shown.assumptions.notes.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted)" }}>
                      {shown.assumptions.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>Override notes</h3>
                  {notes.length === 0 ? (
                    <p style={{ fontSize: 14, color: "var(--muted)" }}>No manual overrides on this prediction.</p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                      {notes.map((n, i) => (
                        <li key={i} style={{ display: "flex", gap: 12 }}>
                          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary-soft)", color: "var(--primary-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flex: "none" }}>
                            {n.name
                              .split(/\s+/)
                              .map((w) => w[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                              {n.name} · {fmtDate(n.at)}
                            </span>
                            <p style={{ fontSize: 14, lineHeight: 1.55 }}>{n.text}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {cur.history.length > 0 && (
                  <section className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>Earlier versions</h3>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                      {cur.history.map((h) => (
                        <li key={h.version} style={{ display: "flex", gap: 12 }}>
                          <span className="chip num">v{h.version}</span>
                          <span className="num">{money(h.base, cur.company.currency)}</span>
                          <span className="muted">{h.publishedAt ? `published ${fmtDate(h.publishedAt)}` : `drafted ${fmtDate(h.createdAt)} · not published`}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </section>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        alert
        maxWidth={480}
        title={`Publish the new ${cur?.company.ticker} prediction?`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirm(false)} data-autofocus>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={async () => {
                const res = await exec(() => publishPredictionAction(cur!.draft!.id), { success: `${cur!.company.ticker} v${cur!.draft!.version} is live on the public site.` });
                if (res.ok) setConfirm(false);
              }}
            >
              Publish now
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>The public pitch, chart and chat switch to the draft immediately. The current version moves to history and stays in the track record.</p>
          {cur?.draft && (
            <div style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 10, background: "var(--subtle)", alignItems: "center" }}>
              {cur.published && (
                <>
                  <span className="num muted" style={{ textDecoration: "line-through" }}>
                    {money(cur.published.scenarios.base.y3, cur.company.currency)}
                  </span>
                  <ArrowRight size={14} aria-hidden />
                </>
              )}
              <span className="num" style={{ fontWeight: 600 }}>
                {money(cur.draft.scenarios.base.y3, cur.company.currency)}
              </span>
              {cur.published && (
                <span style={{ marginLeft: "auto" }}>
                  <UpsideBadge value={cur.draft.scenarios.base.y3 / cur.published.scenarios.base.y3 - 1} label="Change" />
                </span>
              )}
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add override note"
        subtitle="What did you change by hand, and why? Notes are kept with the prediction and in the audit log."
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={note.trim().length < 5 || pending}
              onClick={async () => {
                const res = await exec(() => addOverrideNote(shown!.id, note));
                if (res.ok) {
                  setNote("");
                  setNoteOpen(false);
                }
              }}
            >
              Save note
            </button>
          </>
        }
      >
        <div className="field">
          <label className="label" htmlFor="note-in">
            Note
          </label>
          <textarea id="note-in" className="textarea" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} data-autofocus />
        </div>
      </Dialog>
    </div>
  );
}
