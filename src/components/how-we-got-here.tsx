"use client";

import Link from "next/link";
import { CitationChip, type CiteSource } from "@/components/citation";
import { FactorRadar } from "@/components/factor-radar";
import { ValuationWaterfall } from "@/components/valuation-waterfall";
import { Disclaimer } from "@/components/ui/figures";
import { fmtMonthYear, money, multiple, pct, signedPct } from "@/lib/format";
import { toHundred } from "@/lib/valuation/qualitative";
import { FACTOR_LABELS, type Assumptions, type FactorScore, type WaterfallStep } from "@/lib/valuation/types";

interface Props {
  a: Assumptions;
  waterfall: WaterfallStep[];
  factors: FactorScore[];
  currency: string;
  ticker: string;
  epsSource: CiteSource | null;
  onCite: (s: CiteSource) => void;
  disclaimer: string;
  /** Public methodology appendix of the customer-evidence study, when one is published. */
  evidencePath?: string | null;
}

type Read = { text: string; cls: string };
const better = (v: number | null, ref: number | null, higherIsBetter = true): Read | null => {
  if (v === null || ref === null) return null;
  const d = (v - ref) / Math.abs(ref || 1);
  if (Math.abs(d) < 0.05) return { text: "In line", cls: "delta flat" };
  const good = higherIsBetter ? d > 0 : d < 0;
  return good ? { text: "Stronger", cls: "delta up" } : { text: "Weaker", cls: "delta down" };
};

export function HowWeGotHere({ a, waterfall, factors, currency, ticker, epsSource, onCite, disclaimer, evidencePath }: Props) {
  const r = a.ratios;
  const premium = a.pe0 > a.sector.pe * 1.05;
  const discount = a.pe0 < a.sector.pe * 0.95;
  const muted = { fontSize: 13, color: "var(--muted)" } as const;

  const assumptions: { name: string; ours: string; ref: string; source: React.ReactNode }[] = [
    { name: `Base EPS (FY${a.epsYear ?? "latest"})`, ours: money(a.eps0, currency), ref: "—", source: epsSource ? <CitationChip source={epsSource} onOpen={onCite} /> : <span style={muted}>Approved reports</span> },
    {
      name: "EPS growth, first year",
      ours: pct(a.growth.blended),
      ref: `${pct(a.growth.sector)} sector`,
      source: (
        <span style={muted}>
          Blend of record {pct(a.growth.historical)}, sustainable {pct(a.growth.sustainable)} and sector
        </span>
      ),
    },
    { name: "Growth path, years 1–3", ours: a.growth.path.map((g) => pct(g)).join(" · "), ref: "Eases toward sector", source: <span style={muted}>Mean reversion each year</span> },
    { name: "P/E — today vs exit", ours: `${multiple(a.exitPe.final)} exit`, ref: `${multiple(a.pe0)} now`, source: <span style={muted}>Price {a.priceDate ? `of ${a.priceDate}` : "today"}</span> },
    { name: "Sector P/E benchmark", ours: multiple(a.sector.pe), ref: a.sector.name, source: <span style={muted}>Sector file</span> },
    { name: "Qualitative tilt", ours: signedPct(a.qualitative.tiltPct), ref: `cap ±${pct(a.model.tiltCap, 0)}`, source: <span style={muted}>Factor scores, below</span> },
    {
      name: "Discounted cash flow",
      ours: a.dcf ? `${pct(a.dcf.weight, 0)} weight` : "Not used",
      ref: a.dcf ? `${pct(a.dcf.fcfConversion, 0)} cash conversion` : "—",
      source: <span style={muted}>{a.dcf ? `${pct(a.dcf.costOfEquity)} cost of equity, ${pct(a.dcf.terminalGrowth)} terminal growth after ${a.dcf.fadeYears} years` : "See notes below"}</span>,
    },
    { name: "Dividend cross-check", ours: a.ddm ? `${pct(a.ddm.weight, 0)} weight` : "Not used", ref: a.ddm ? `${pct(a.ddm.costOfEquity)} cost of equity` : "No dividend", source: <span style={muted}>Dividend discount model</span> },
    { name: "Horizon", ours: `${a.horizonYears} years`, ref: fmtMonthYear(a.horizonDate), source: <span style={muted}>—</span> },
  ];

  const ratios: { name: string; v: string; s: string; read: Read | null }[] = [
    { name: "P/E", v: multiple(r.pe), s: multiple(a.sector.pe), read: premium ? { text: "Premium", cls: "warn-chip" } : discount ? { text: "Discount", cls: "delta up" } : { text: "In line", cls: "delta flat" } },
    { name: "P/B", v: multiple(r.pb), s: "—", read: null },
    { name: "Dividend yield", v: pct(r.dividendYield), s: "—", read: null },
    { name: "Return on equity", v: pct(r.roe), s: pct(a.sector.roe), read: better(r.roe, a.sector.roe) },
    { name: "EPS growth (record)", v: pct(r.epsCagr), s: pct(a.sector.growth), read: better(r.epsCagr, a.sector.growth) },
    { name: "Net margin", v: pct(r.netMargin), s: "—", read: null },
    { name: "Debt / equity", v: r.debtToEquity === null ? "n/a" : r.debtToEquity.toFixed(2), s: "—", read: null },
    { name: "Current ratio", v: r.currentRatio === null ? "n/a" : r.currentRatio.toFixed(2), s: "—", read: null },
    { name: "Free cash flow yield", v: pct(r.fcfYield), s: "—", read: null },
  ];

  return (
    <div role="tabpanel" aria-label="How We Got Here" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Valuation waterfall</h3>
          <p style={muted}>From today&apos;s price to the base-case target, in {currency} per share.</p>
        </div>
        <ValuationWaterfall steps={waterfall} currency={currency} />
        {a.methods && (
          <div className="tbl-box" style={{ borderRadius: 10 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="r">Value in year 3</th>
                  <th className="r">Weight</th>
                  <th>What it measures</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["P/E multiple", a.methods.pe, a.methods.weights.pe, "Projected earnings × the exit P/E"],
                    ["Discounted cash flow", a.methods.dcf, a.methods.weights.dcf, "Future free cash flow, discounted to that date"],
                    ["Dividend discount", a.methods.ddm, a.methods.weights.ddm, "Future dividends, discounted to that date"],
                  ] as const
                ).map(([name, value, weight, what]) => (
                  <tr key={name}>
                    <td style={{ fontWeight: 500 }}>{name}</td>
                    <td className="r num">{value === null || weight === 0 ? "Not used" : money(value, currency)}</td>
                    <td className="r num">{pct(weight, 0)}</td>
                    <td style={muted}>{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {a.methods && <p style={muted}>Values are before the qualitative adjustment. The waterfall&apos;s cross-check steps are each method&apos;s weight × its difference from the P/E value.</p>}
      </section>

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Assumptions</h3>
        <div className="tbl-box" style={{ borderRadius: 10 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Assumption</th>
                <th className="r">AutoVise</th>
                <th className="r">Now / sector</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {assumptions.map((x) => (
                <tr key={x.name}>
                  <td>{x.name}</td>
                  <td className="r num">{x.ours}</td>
                  <td className="r num muted">{x.ref}</td>
                  <td>{x.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {a.notes.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, ...muted }}>
            {a.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Qualitative factors</h3>
          <p style={muted}>Scored 0–100 from report text and company news. Higher is better; for risk, higher means lower risk.</p>
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "0 1 340px", minWidth: 260 }}>
            <FactorRadar
              labels={factors.map((f) => FACTOR_LABELS[f.key])}
              series={[{ name: ticker, values: factors.map((f) => toHundred(f.score)), color: "var(--c2)" }]}
              label={`Radar chart of six factor scores: ${factors.map((f) => `${FACTOR_LABELS[f.key]} ${toHundred(f.score)}`).join(", ")}.`}
            />
          </div>
          <ul style={{ flex: "1 1 360px", margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
            {factors.map((f) => (
              <li key={f.key} style={{ display: "grid", gridTemplateColumns: "150px 40px minmax(0, 1fr)", gap: 12, alignItems: "baseline" }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{FACTOR_LABELS[f.key]}</span>
                <span className="num" style={{ fontWeight: 600, textAlign: "right" }}>
                  {toHundred(f.score)}
                </span>
                <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                  {f.justification}
                  {f.evidence.slice(0, 2).map((e, i) => (
                    <span key={i} style={{ marginLeft: 6 }}>
                      <CitationChip source={{ id: `${f.key}-${i}`, label: e.label ?? "Report", page: e.page ?? null, quote: e.quote }} onOpen={onCite} />
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Key ratios</h3>
        <div className="tbl-box" style={{ borderRadius: 10 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Ratio</th>
                <th className="r">{ticker}</th>
                <th className="r">Sector</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {ratios.map((x) => (
                <tr key={x.name}>
                  <td>{x.name}</td>
                  <td className="r num">{x.v}</td>
                  <td className="r num muted">{x.s}</td>
                  <td>{x.read ? <span className={x.read.cls}>{x.read.text}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {evidencePath && (
        <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Customer evidence</h3>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
            The pitch quotes a few findings from an exploratory study of public customer accounts. They add context only: the study is not an input to the valuation above, and none of these numbers depend on it.
          </p>
          <Link href={evidencePath} prefetch={false} style={{ fontSize: 14, alignSelf: "flex-start" }}>
            Read how the customer evidence was collected and checked
          </Link>
        </section>
      )}
      <Disclaimer text={disclaimer} icon={false} />
    </div>
  );
}
