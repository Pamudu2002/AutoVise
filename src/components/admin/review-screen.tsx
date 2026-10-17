"use client";

import { ArrowLeft, Check, Pencil, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { useAction } from "@/components/admin/use-action";
import { StatusPill } from "@/components/ui/figures";
import { Select } from "@/components/ui/fields";
import { addMetricPeriod, approveVersion, reprocessVersion, setInsightIncluded, updateMetric } from "@/lib/actions/reports";
import { METRIC_FIELDS, METRIC_LABELS, UNSCALED_FIELDS, type MetricField } from "@/lib/ai/schemas";
import type { FinancialMetric } from "@/lib/db/schema";
import { num } from "@/lib/format";
import { REPORT_TYPE_LABEL, STATUS_LABEL } from "@/lib/reports/files";

type Metric = Omit<FinancialMetric, "createdAt"> & { createdAt: string };
interface Insight {
  id: string;
  category: string;
  summary: string;
  sentiment: number;
  impact: "low" | "med" | "high";
  quote: string | null;
  page: number | null;
  included: boolean;
}

interface Props {
  version: { id: string; versionNo: number; status: keyof typeof STATUS_LABEL; fileName: string; url: string; isPdf: boolean; pageCount: number | null; error: string | null; current: boolean };
  report: { id: string; title: string; type: keyof typeof REPORT_TYPE_LABEL; fiscalPeriod: string };
  company: { name: string; ticker: string; slug: string; currency: string };
  metrics: Metric[];
  insights: Insight[];
  sheets: { page: number | null; content: string }[];
  canReview: boolean;
  canWrite: boolean;
}

const unitLabel = (m: number, cur: string) => (m >= 1e9 ? `${cur} billion` : m >= 1e6 ? `${cur} million` : m >= 1e3 ? `${cur} thousand` : cur);
const CAT: Record<string, string> = {
  management: "Management",
  strategy: "Strategy",
  outlook: "Growth outlook",
  risk: "Risk",
  governance: "Governance",
  esg: "ESG",
  market: "Market",
  capital_allocation: "Capital allocation",
};

/** Report review (ReportReview.dc.html): PDF on the left, extracted data on the right. */
export function ReviewScreen({ version, report, company, metrics, insights, sheets, canReview, canWrite }: Props) {
  const { exec, pending } = useAction();
  const [page, setPage] = useState(1);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [editing, setEditing] = useState<{ id: string; field: MetricField; draft: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPeriod, setNewPeriod] = useState<{ fiscalYear: string; period: "FY" | "H1" | "Q1" | "Q2" | "Q3" | "Q4" | "9M"; unitMultiplier: string }>({ fiscalYear: String(new Date().getUTCFullYear() - 1), period: "FY", unitMultiplier: "1000000" });
  const busy = version.status === "processing" || version.status === "uploaded";
  const periods = useMemo(() => [...metrics].sort((a, b) => b.fiscalYear - a.fiscalYear || a.period.localeCompare(b.period)), [metrics]);
  const m = periods[Math.min(periodIdx, periods.length - 1)];
  const included = insights.filter((i) => i.included).length;

  const goto = (p: number | null | undefined) => p && setPage(p);
  const confRead = (c: number | undefined) =>
    c === undefined ? { cls: "pill pill-draft", text: "Manual" } : c >= 90 ? { cls: "pill pill-approved", text: `High · ${c}` } : c >= 75 ? { cls: "pill pill-review", text: `Check · ${c}` } : { cls: "pill pill-failed", text: `Low · ${c}` };

  const saveEdit = async () => {
    if (!editing) return;
    const raw = editing.draft.replace(/,/g, "").trim();
    const value = raw === "" ? null : Number(raw.replace(/^\((.*)\)$/, "-$1"));
    if (value !== null && !Number.isFinite(value)) return;
    const res = await exec(() => updateMetric(editing.id, editing.field, value), { quiet: true });
    if (res.ok) setEditing(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 64px)" }}>
      <AutoRefresh when={busy} />
      <header style={{ minHeight: 64, display: "flex", alignItems: "center", gap: 16, padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexWrap: "wrap" }}>
        <Link className="btn btn-ghost btn-icon btn-sm" href={`/admin/companies/${company.slug}/reports`} aria-label="Back to reports">
          <ArrowLeft size={16} aria-hidden />
        </Link>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: "1 1 280px" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 16, fontWeight: 600 }}>{report.title}</h1>
            <span className="chip num">v{version.versionNo}</span>
            <StatusPill status={version.status} label={STATUS_LABEL[version.status]} />
            {!version.current && <span className="pill pill-superseded">Not current</span>}
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {company.name} · {REPORT_TYPE_LABEL[report.type]} · {report.fiscalPeriod} · <span className="num">{version.fileName}</span>
          </span>
        </div>
        <span className="tnum hide-sm" style={{ fontSize: 13, color: "var(--muted)" }}>
          {included} of {insights.length} insights included
        </span>
        {canWrite && (
          <button className="btn btn-secondary" disabled={busy || pending || !version.current || version.status === "superseded"} onClick={() => exec(() => reprocessVersion(version.id))}>
            <RotateCcw size={16} aria-hidden />
            Re-extract
          </button>
        )}
        {canReview && (
          <button
            className="btn btn-primary"
            disabled={busy || pending || version.status !== "review" || !version.current}
            onClick={() => exec(() => approveVersion(version.id), { action: { label: "Open", href: `/admin/predictions?company=${company.slug}` } })}
          >
            <Check size={16} aria-hidden />
            {version.status === "approved" ? "Approved" : "Approve"}
          </button>
        )}
      </header>

      {version.error && (
        <div role="status" style={{ padding: "10px 20px", fontSize: 13, background: version.status === "failed" ? "var(--neg-soft)" : "var(--warn-soft)" }}>
          {version.error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexWrap: "wrap" }}>
        <section style={{ flex: "1 1 520px", minWidth: 0, display: "flex", flexDirection: "column", background: "var(--subtle)", borderRight: "1px solid var(--border)", minHeight: 600 }} aria-label="Report document">
          <div style={{ height: 48, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
            <span className="num" style={{ fontSize: 13 }}>
              Page {page}
              {version.pageCount ? ` / ${version.pageCount}` : ""}
            </span>
            <span style={{ flex: 1 }} />
            <a className="btn btn-ghost btn-sm" href={version.url} target="_blank" rel="noopener noreferrer">
              Open in new tab
            </a>
          </div>
          {version.isPdf ? (
            <iframe key={page} title={`${report.title}, page ${page}`} src={`${version.url}#page=${page}&view=FitH`} style={{ flex: 1, width: "100%", border: 0, minHeight: 560, background: "var(--subtle)" }} />
          ) : (
            <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {sheets.length === 0 && <p className="hint">The spreadsheet text appears here after processing.</p>}
              {sheets.map((s, i) => (
                <pre key={i} style={{ margin: 0, padding: 14, borderRadius: 10, background: "var(--card)", border: `1px solid ${s.page === page ? "var(--primary)" : "var(--border)"}`, fontSize: 12, whiteSpace: "pre-wrap", fontFamily: "var(--mono)" }}>
                  {s.content}
                </pre>
              ))}
            </div>
          )}
        </section>

        <section style={{ flex: "1 1 560px", minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }} aria-label="Extracted data">
          {busy ? (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }} aria-busy="true" aria-label="Extracting">
              <span className="pill pill-processing" style={{ alignSelf: "flex-start" }}>
                Extracting{version.pageCount ? ` from ${version.pageCount} pages` : ""}…
              </span>
              <div className="sk" style={{ height: 18, width: "40%" }} />
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="sk" style={{ height: 40 }} />
              ))}
              <div className="sk" style={{ height: 18, width: "32%", marginTop: 16 }} />
              <div className="sk" style={{ height: 96 }} />
              <div className="sk" style={{ height: 96 }} />
            </div>
          ) : (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
              <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600 }}>Quantitative metrics</h2>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {periods.length > 1 && (
                      <div style={{ width: 150 }}>
                        <label className="sr-only" htmlFor="period">
                          Period
                        </label>
                        <Select id="period" style={{ height: 32, fontSize: 13 }} value={periodIdx} onChange={(e) => setPeriodIdx(Number(e.target.value))}>
                          {periods.map((p, i) => (
                            <option key={p.id} value={i}>
                              {p.period} {p.fiscalYear}
                              {i === 0 ? " (current)" : ""}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                    {canReview && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}>
                        <Plus size={14} aria-hidden />
                        Add period
                      </button>
                    )}
                  </div>
                </div>
                {adding && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await exec(() => addMetricPeriod(version.id, newPeriod));
                      if (res.ok) {
                        setAdding(false);
                        setPeriodIdx(0);
                      }
                    }}
                    className="card"
                    style={{ padding: 12, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", boxShadow: "none" }}
                  >
                    <div className="field" style={{ width: 100 }}>
                      <label className="label" htmlFor="np-y">
                        Year
                      </label>
                      <input id="np-y" className="input num" style={{ height: 34 }} value={newPeriod.fiscalYear} onChange={(e) => setNewPeriod({ ...newPeriod, fiscalYear: e.target.value })} />
                    </div>
                    <div className="field" style={{ width: 100 }}>
                      <label className="label" htmlFor="np-p">
                        Period
                      </label>
                      <Select id="np-p" style={{ height: 34 }} value={newPeriod.period} onChange={(e) => setNewPeriod({ ...newPeriod, period: e.target.value as typeof newPeriod.period })}>
                        {["FY", "H1", "Q1", "Q2", "Q3", "Q4", "9M"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="field" style={{ width: 160 }}>
                      <label className="label" htmlFor="np-u">
                        Statement units
                      </label>
                      <Select id="np-u" style={{ height: 34 }} value={newPeriod.unitMultiplier} onChange={(e) => setNewPeriod({ ...newPeriod, unitMultiplier: e.target.value })}>
                        <option value="1">{company.currency}</option>
                        <option value="1000">{company.currency} thousand</option>
                        <option value="1000000">{company.currency} million</option>
                        <option value="1000000000">{company.currency} billion</option>
                      </Select>
                    </div>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      Add
                    </button>
                  </form>
                )}
                {!m ? (
                  <p className="hint">No figures were extracted. {canReview ? "Add a period to enter them by hand." : ""}</p>
                ) : (
                  <>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {m.period} {m.fiscalYear} · {unitLabel(m.unitMultiplier, company.currency)} unless per share · select a page to see it
                    </span>
                    <div className="tbl-box">
                      <table className="tbl" style={{ fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th>Metric</th>
                            <th className="r">Value</th>
                            <th>Source</th>
                            <th>Read</th>
                            <th className="r">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {METRIC_FIELDS.map((field) => {
                            const value = m[field] as number | null;
                            const pg = m.sourcePages?.[field];
                            const conf = m.extra?.confidence?.[field];
                            const read = value === null && conf === undefined ? null : confRead(conf);
                            const edited = m.edits && field in m.edits;
                            const isEditing = editing?.id === m.id && editing.field === field;
                            const dp = UNSCALED_FIELDS.includes(field) && field !== "sharesOutstanding" ? 2 : 0;
                            return (
                              <tr key={field} style={pg === page ? { outline: "2px solid var(--primary)", outlineOffset: -2 } : undefined}>
                                <td style={{ fontWeight: 500 }}>
                                  {METRIC_LABELS[field]}
                                  {field === "eps" || field === "dps" ? ` (${company.currency})` : ""}
                                </td>
                                <td className="r">
                                  {isEditing ? (
                                    <>
                                      <label htmlFor={`in-${field}`} className="sr-only">
                                        {METRIC_LABELS[field]} value
                                      </label>
                                      <input
                                        id={`in-${field}`}
                                        className="input num"
                                        style={{ height: 32, width: 120, textAlign: "right" }}
                                        value={editing.draft}
                                        autoFocus
                                        onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") void saveEdit();
                                          if (e.key === "Escape") setEditing(null);
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <span className="num" style={{ fontWeight: 600 }}>
                                        {value === null ? "—" : num(value, dp)}
                                      </span>
                                      {edited && (
                                        <span style={{ display: "block", fontSize: 11, color: "var(--warn)" }}>
                                          edited · was {m.edits![field] === null ? "empty" : num(m.edits![field] as number, dp)}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </td>
                                <td>
                                  {pg ? (
                                    <button className="cite" onClick={() => goto(pg)}>
                                      p.{pg}
                                    </button>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                                <td>{read ? <span className={read.cls}>{read.text}</span> : <span className="muted">—</span>}</td>
                                <td className="r">
                                  {canReview &&
                                    (isEditing ? (
                                      <div style={{ display: "inline-flex", gap: 4 }}>
                                        <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={pending}>
                                          Save
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Edit ${METRIC_LABELS[field]}`} onClick={() => setEditing({ id: m.id, field, draft: value === null ? "" : String(value) })}>
                                        <Pencil size={14} aria-hidden />
                                      </button>
                                    ))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600 }}>Qualitative insights</h2>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {included} of {insights.length} included in the factor scores
                  </span>
                </div>
                {insights.length === 0 && <p className="hint">No insights were extracted from this report.</p>}
                {insights.map((i) => (
                  <article key={i.id} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, opacity: i.included ? 1 : 0.6, boxShadow: "none" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="chip" style={{ color: "var(--text)" }}>
                        {CAT[i.category] ?? i.category}
                      </span>
                      <span className={`delta ${i.sentiment > 0.15 ? "up" : i.sentiment < -0.15 ? "down" : "flat"}`}>{i.sentiment > 0.15 ? "Positive" : i.sentiment < -0.15 ? "Negative" : "Neutral"}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        Impact: <strong style={{ color: "var(--text)", fontWeight: 600 }}>{i.impact === "med" ? "Medium" : i.impact[0].toUpperCase() + i.impact.slice(1)}</strong>
                      </span>
                      <span style={{ flex: 1 }} />
                      <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, cursor: canReview ? "pointer" : "default" }}>
                        <input type="checkbox" className="check" checked={i.included} disabled={!canReview || pending} onChange={() => exec(() => setInsightIncluded(i.id, !i.included), { quiet: true })} />
                        Include
                      </label>
                    </div>
                    <p style={{ fontWeight: 500, lineHeight: 1.5 }}>{i.summary}</p>
                    {i.quote && (
                      <blockquote style={{ margin: 0, padding: "10px 12px", borderRadius: 8, background: "var(--subtle)", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>
                        “{i.quote}”
                      </blockquote>
                    )}
                    {i.page && (
                      <button className="cite" style={{ alignSelf: "flex-start" }} onClick={() => goto(i.page)}>
                        Page {i.page}
                      </button>
                    )}
                  </article>
                ))}
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
