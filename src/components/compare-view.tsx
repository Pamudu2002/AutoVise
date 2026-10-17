"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { FactorRadar } from "@/components/factor-radar";
import { Disclaimer, meterClass } from "@/components/ui/figures";
import { Select } from "@/components/ui/fields";
import type { CompareRow } from "@/lib/data/insights";
import { fmtMonthYear, money, multiple, num, pct, signedPct } from "@/lib/format";
import { FACTOR_KEYS, FACTOR_LABELS } from "@/lib/valuation/types";

const SERIES = [
  { color: "var(--c1)", dash: undefined, line: "solid" },
  { color: "var(--c2)", dash: "6 4", line: "dashed" },
  { color: "var(--c4)", dash: "2 3", line: "dotted" },
];

type Cell = { value: number | string | null; text: string; kind?: "delta" | "meter"; bold?: boolean };

/** Up to three companies side by side; the strongest value in each comparable row is marked "Best". */
export function CompareView({ rows, selected, disclaimer }: { rows: CompareRow[]; selected: string[]; disclaimer: string }) {
  const router = useRouter();
  const picked = selected.map((s) => rows.find((r) => r.slug === s)).filter((r): r is CompareRow => !!r);
  const setSlots = (slugs: string[]) => router.replace(`/compare?c=${slugs.join(",")}`, { scroll: false });
  const free = rows.filter((r) => !picked.some((p) => p.id === r.id));

  const row = (label: string, get: (c: CompareRow) => number | string | null, fmt: (v: number, c: CompareRow) => string, dir: 1 | -1 | 0, opts: { note?: string; kind?: Cell["kind"]; bold?: boolean } = {}) => {
    const vals = picked.map(get);
    const nums = vals.filter((v): v is number => typeof v === "number");
    const best = dir && nums.length > 1 ? (dir > 0 ? Math.max(...nums) : Math.min(...nums)) : null;
    return {
      label,
      note: opts.note,
      cells: vals.map((v, i): Cell & { best: boolean } => ({
        value: v,
        text: v === null ? "n/a" : typeof v === "number" ? fmt(v, picked[i]) : v,
        kind: opts.kind,
        bold: opts.bold,
        best: best !== null && v === best,
      })),
    };
  };

  const table = [
    row("Current price", (c) => c.price, (v, c) => money(v, c.currency), 0, { bold: true }),
    row("3-yr target · base", (c) => c.target, (v, c) => money(v, c.currency), 0, { bold: true }),
    row("Upside to base", (c) => (c.target && c.price ? c.target / c.price - 1 : null), (v) => signedPct(v), 1, { kind: "delta" }),
    row("Bear / bull", (c) => c.bear, (v, c) => `${num(c.bear!)} / ${num(c.bull!)}`, 0, { note: picked[0]?.horizonDate ? `${picked[0].currency}, ${fmtMonthYear(picked[0].horizonDate)}` : undefined }),
    row("Confidence", (c) => c.confidence, (v) => String(v), 1, { kind: "meter" }),
    row("AutoVise Score", (c) => c.score, (v) => String(v), 1, { bold: true }),
    row("P/E", (c) => c.pe, (v) => multiple(v), -1),
    row("Dividend yield", (c) => c.dividendYield, (v) => pct(v), 1),
    row("Return on equity", (c) => c.roe, (v) => pct(v), 1),
    row("Net margin", (c) => c.netMargin, (v) => pct(v), 1),
    row("Debt / equity", (c) => (c.isBank ? null : c.debtToEquity), (v) => v.toFixed(2), -1, { note: "Not meaningful for banks" }),
    row("Latest report", (c) => c.latestReport, () => "", 0),
  ];

  const withFactors = picked.filter((p) => p.factors);

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ fontSize: 32, fontWeight: 600 }}>Compare companies</h1>
          <p style={{ color: "var(--muted)", fontSize: 15 }}>Up to three side by side. The strongest value in each row is marked.</p>
        </div>
        <Disclaimer text={disclaimer} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 16 }}>
        {picked.map((c, i) => (
          <div key={c.id} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: SERIES[i].color, display: "inline-block" }} aria-hidden />
              <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>Company {i + 1}</span>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${c.name}`} disabled={picked.length <= 1} onClick={() => setSlots(picked.filter((p) => p.id !== c.id).map((p) => p.slug))}>
                <X size={16} aria-hidden />
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <CompanyLogo {...c} size={32} decorative />
              <div className="field" style={{ flex: 1 }}>
                <label className="sr-only" htmlFor={`cmp-${i}`}>
                  Company {i + 1}
                </label>
                <Select
                  id={`cmp-${i}`}
                  value={c.slug}
                  onChange={(e) => {
                    const next = picked.map((p) => p.slug);
                    next[i] = e.target.value;
                    setSlots(next);
                  }}
                >
                  {[c, ...free].map((o) => (
                    <option key={o.id} value={o.slug}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        ))}
        {picked.length < 3 && free.length > 0 && (
          <button className="drop" style={{ minHeight: 130, cursor: "pointer", color: "var(--muted)", font: "500 14px var(--font)" }} onClick={() => setSlots([...picked.map((p) => p.slug), free[0].slug])}>
            <Plus size={20} aria-hidden />
            Add a company
          </button>
        )}
      </div>

      {picked.length > 0 && (
        <section className="tbl-box">
          <table className="tbl" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ width: 220 }}>Metric</th>
                {picked.map((c, i) => (
                  <th key={c.id} className="r">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--text)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: SERIES[i].color }} />
                      <CompanyLogo {...c} size={32} decorative />
                      <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>
                        {c.ticker}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.label}>
                  <td style={{ fontWeight: 500 }}>
                    {r.label}
                    {r.note && <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{r.note}</div>}
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="r">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        {c.best && (
                          <span className="pill pill-approved" style={{ height: 20, fontSize: 11 }}>
                            Best
                          </span>
                        )}
                        {c.kind === "delta" && typeof c.value === "number" ? (
                          <span className={`delta ${c.value >= 0 ? "up" : "down"}`}>{c.text}</span>
                        ) : c.kind === "meter" && typeof c.value === "number" ? (
                          <>
                            <span className={meterClass(c.value)} style={{ width: 72, display: "inline-block" }}>
                              <span style={{ display: "block", height: "100%", width: `${c.value}%` }} />
                            </span>
                            <span className="num" style={{ fontWeight: 600, width: 24 }}>
                              {c.text}
                            </span>
                          </>
                        ) : (
                          <span className={typeof c.value === "number" ? "num" : undefined} style={c.bold ? { fontWeight: 600 } : undefined}>
                            {c.text}
                          </span>
                        )}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {withFactors.length > 0 && (
        <section className="card" style={{ padding: 24, display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Qualitative factors, overlaid</h2>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>Each company&apos;s six factor scores (0–100) from its latest reports. For risk, a higher score means lower risk.</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {picked.map((c, i) =>
                c.factors ? (
                  <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                    <span style={{ width: 22, height: 0, borderTop: `3px ${SERIES[i].line} ${SERIES[i].color}` }} aria-hidden />
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    <span className="num muted" style={{ marginLeft: "auto" }}>
                      avg {Math.round(c.factors.reduce((a, b) => a + b, 0) / c.factors.length)}
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
          <div style={{ flex: "0 1 420px", minWidth: 280 }}>
            <FactorRadar
              labels={FACTOR_KEYS.map((k) => FACTOR_LABELS[k])}
              series={picked.map((c, i) => ({ name: c.ticker, values: c.factors ?? [], color: SERIES[i].color, dash: SERIES[i].dash })).filter((s) => s.values.length)}
              height={320}
              label={`Factor scores overlaid for ${withFactors.map((c) => c.name).join(", ")}.`}
            />
          </div>
        </section>
      )}
    </div>
  );
}
