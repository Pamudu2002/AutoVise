import { ArrowDownRight, ArrowRight, ArrowUpRight, FileText } from "lucide-react";
import type { SourceReport } from "@/lib/data/public";
import { num } from "@/lib/format";
import { REPORT_TYPE_LABEL } from "@/lib/reports/files";
import type { AnnualFinancials } from "@/lib/valuation/types";

type Row = { name: string; values: (number | null)[]; d: number; good: 1 | -1; pct?: boolean; scale?: boolean };

/** Multi-year figures with trend arrows (green/red = helps/hurts the case) and the source reports. */
export function FinancialsTab({ history, reports, currency }: { history: AnnualFinancials[]; reports: SourceReport[]; currency: string }) {
  const years = history.slice(-5);
  const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b !== 0 ? (a / b) * 100 : null);
  const rows: Row[] = [
    { name: "Revenue", values: years.map((y) => y.revenue), d: 0, good: 1, scale: true },
    { name: "Net income", values: years.map((y) => y.netIncome), d: 0, good: 1, scale: true },
    { name: `EPS (${currency})`, values: years.map((y) => y.eps), d: 2, good: 1 },
    { name: "Net margin", values: years.map((y) => ratio(y.netIncome, y.revenue)), d: 1, good: 1, pct: true },
    { name: "Return on equity", values: years.map((y) => ratio(y.netIncome, y.totalEquity)), d: 1, good: 1, pct: true },
    { name: "Debt / equity", values: years.map((y) => (y.totalDebt !== null && y.totalEquity ? y.totalDebt / y.totalEquity : null)), d: 2, good: -1 },
    { name: `Dividend / share (${currency})`, values: years.map((y) => y.dps), d: 2, good: 1 },
  ];
  const fmt = (r: Row, v: number | null) => (v === null ? "—" : num(r.scale ? v / 1e6 : v, r.d) + (r.pct ? "%" : ""));

  return (
    <div role="tabpanel" aria-label="Financials" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{years.length >= 5 ? "Five-year" : "Multi-year"} financials</h3>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{currency} million unless stated · from approved reports</span>
        </div>
        {years.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No approved annual figures yet.</p>
        ) : (
          <div className="tbl-box" style={{ borderRadius: 10 }}>
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Metric</th>
                  {years.map((y) => (
                    <th key={y.year} className="r">
                      FY{y.year}
                    </th>
                  ))}
                  {years.length > 1 && <th className="r">vs FY{String(years[years.length - 2].year).slice(2)}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const last = r.values[r.values.length - 1];
                  const prev = r.values[r.values.length - 2];
                  const ch = last !== null && prev !== null && prev !== undefined && prev !== 0 ? (last - prev) / Math.abs(prev) : null;
                  const flat = ch !== null && Math.abs(ch) < 0.015;
                  const good = ch !== null && ch * r.good > 0;
                  const Icon = ch === null || flat ? ArrowRight : ch > 0 ? ArrowUpRight : ArrowDownRight;
                  return (
                    <tr key={r.name}>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className="r num" style={i === r.values.length - 1 ? { fontWeight: 600 } : undefined}>
                          {fmt(r, v)}
                        </td>
                      ))}
                      {years.length > 1 && (
                        <td className="r">
                          {ch === null ? (
                            <span className="muted">—</span>
                          ) : (
                            <span
                              style={{ display: "inline-flex", color: flat ? "var(--muted)" : good ? "var(--pos)" : "var(--neg)" }}
                              aria-label={`${flat ? "Flat" : ch > 0 ? "Up" : "Down"} ${Math.abs(ch * 100).toFixed(1)}%`}
                              title={`${ch > 0 ? "+" : "−"}${Math.abs(ch * 100).toFixed(1)}%`}
                            >
                              <Icon size={14} strokeWidth={2.4} aria-hidden />
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Green and red show whether the change helps or hurts the case — falling debt/equity is shown green.</span>
      </section>

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Source reports</h3>
        {reports.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No approved reports yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
            {reports.map((r) => (
              <li key={r.versionId} style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                <span style={{ width: 36, height: 36, borderRadius: 9, background: "var(--subtle)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", flex: "none" }}>
                  <FileText size={18} strokeWidth={1.8} aria-hidden />
                </span>
                <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, color: "var(--text)" }}>
                    {r.title}
                  </a>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {REPORT_TYPE_LABEL[r.type as keyof typeof REPORT_TYPE_LABEL] ?? r.type} · {r.fiscalPeriod}
                    {r.pageCount ? ` · ${r.pageCount} pages` : ""}
                  </span>
                </div>
                <span className="chip num">v{r.versionNo}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", width: 170 }}>{r.note}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
