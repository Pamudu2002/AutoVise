import "server-only";
import type { Citation, Pitch } from "@/lib/ai/schemas";
import type { CompanyPageData } from "@/lib/data/public";
import { fmtDate, fmtMonthYear, money, multiple, pct, signedPct } from "@/lib/format";
import { toHundred } from "@/lib/valuation/qualitative";
import { FACTOR_LABELS } from "@/lib/valuation/types";
import type { RetrievedChunk } from "./retrieve";

export interface ChatCitation {
  id: string;
  label: string;
  page: number | null;
  quote: string | null;
  url: string | null;
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

function pitchText(p: Pitch): string {
  const c = (ids: string[]) => (ids.length ? " " + ids.map((i) => `[${i}]`).join("") : "");
  return [
    `Thesis: ${p.thesis.headline}`,
    ...p.thesis.paragraphs.map((x) => `  ${x.text}${c(x.cites)}`),
    "Key drivers:",
    ...p.drivers.map((d) => `  - ${d.figure} ${d.title}: ${d.body}${c(d.cites)}`),
    "Valuation walkthrough:",
    ...p.valuation.paragraphs.map((x) => `  ${x.text}`),
    "Risks:",
    ...p.risks.map((r) => `  - ${r.title}: ${r.body}${c(r.cites)}`),
    "Catalysts:",
    ...p.catalysts.map((r) => `  - ${r.title}: ${r.body}${c(r.cites)}`),
    `What would change the view — bull: ${p.changeView.bull} Bear: ${p.changeView.bear}`,
  ].join("\n");
}

export interface ChatEvidenceExample {
  entity: string;
  platform: string;
  text: string;
}

/** The grounding context for the consultant: profile, price, published prediction, pitch, figures and sources. */
export function buildChatContext(data: CompanyPageData, retrieved: RetrievedChunk[], startIndex = 1, examples: ChatEvidenceExample[] = []) {
  const { company: co, prediction: p } = data;
  const cur = co.currency;
  const lines: string[] = [];
  lines.push(`Company: ${co.name} (${co.ticker}), sector ${co.sector}. Currency ${cur}.${co.website ? ` Website ${co.website}.` : ""}`);
  if (co.description) lines.push(`Profile: ${co.description}`);
  lines.push(`Current share price: ${money(co.price, cur)}${co.priceUpdatedAt ? ` (updated ${fmtDate(co.priceUpdatedAt)})` : ""}.`);
  if (data.outdatedLabel) lines.push(`Note: ${data.outdatedLabel} — the newest approved report is more than 12 months old.`);

  const citations: ChatCitation[] = [];
  if (p) {
    const a = p.assumptions;
    lines.push(
      `\nPUBLISHED PREDICTION v${p.version} (published ${fmtDate(p.publishedAt)}; horizon ${fmtMonthYear(a.horizonDate)}):`,
      `Base case: Y1 ${money(p.scenarios.base.y1, cur)}, Y2 ${money(p.scenarios.base.y2, cur)}, Y3 ${money(p.scenarios.base.y3, cur)} (${signedPct(p.upsidePct)} vs the price the prediction used, ${money(p.basePrice, cur)}).`,
      `Bear case Y3 ${money(p.scenarios.bear.y3, cur)}; bull case Y3 ${money(p.scenarios.bull.y3, cur)}.`,
      `Confidence ${p.confidence}/100. AutoVise Score ${p.autoviseScore}/100.`,
      `Base EPS (FY${a.epsYear ?? "latest"}): ${money(a.eps0, cur)}. EPS in year 3: ${money(a.rows[a.rows.length - 1].eps, cur)}.`,
      `EPS growth: ${pct(a.growth.blended)} in year 1, mean-reverting toward the sector's ${pct(a.growth.sector)}; path ${a.growth.path.map((g) => pct(g)).join(", ")}. Blend of historical ${pct(a.growth.historical)}, sustainable ${pct(a.growth.sustainable)} and sector ${pct(a.growth.sector)}.`,
      `P/E: ${multiple(a.pe0)} today, exit ${multiple(a.exitPe.final)} (before qualitative ${multiple(a.exitPe.quant)}); sector benchmark ${multiple(a.sector.pe)}.`,
      `Qualitative composite ${toHundred(a.qualitative.composite)}/100, price effect ${signedPct(a.qualitative.tiltPct)} (capped at ±${pct(a.model.tiltCap, 0)}).`,
      `Dividend cross-check: ${a.ddm ? `weight ${pct(a.ddm.weight, 0)}, cost of equity ${pct(a.ddm.costOfEquity)}` : "not used (no dividend)"}.`,
      `Discounted cash flow: ${
        a.dcf
          ? `weight ${pct(a.dcf.weight, 0)}; free cash flow = EPS × ${pct(a.dcf.fcfConversion)} cash conversion; cost of equity ${pct(a.dcf.costOfEquity)}; growth fades to ${pct(a.dcf.terminalGrowth)} over ${a.dcf.fadeYears} years`
          : "not used for this company"
      }.`,
      ...(a.methods
        ? [
            `Year-3 values before the qualitative adjustment: P/E ${money(a.methods.pe, cur)} (weight ${pct(a.methods.weights.pe, 0)})${a.methods.dcf !== null && a.methods.weights.dcf > 0 ? `, DCF ${money(a.methods.dcf, cur)} (weight ${pct(a.methods.weights.dcf, 0)})` : ""}${a.methods.ddm !== null && a.methods.weights.ddm > 0 ? `, dividend discount ${money(a.methods.ddm, cur)} (weight ${pct(a.methods.weights.ddm, 0)})` : ""}.`,
          ]
        : []),
      `Waterfall: ${p.valuationBreakdown.map((w) => `${w.label} ${w.key === "current" || w.key === "target" ? money(w.value, cur) : (w.value >= 0 ? "+" : "−") + money(Math.abs(w.value), cur)}`).join(" → ")}.`,
      `Factor scores (0–100): ${p.factorScores.map((f) => `${FACTOR_LABELS[f.key]} ${toHundred(f.score)} — ${f.justification}`).join("; ")}`,
      `Key ratios: ROE ${pct(a.ratios.roe)}, net margin ${pct(a.ratios.netMargin)}, debt/equity ${a.ratios.debtToEquity?.toFixed(2) ?? "n/a"}, dividend yield ${pct(a.ratios.dividendYield)}, P/B ${multiple(a.ratios.pb)}.`,
    );
    if (p.pitch) lines.push(`\nPITCH:\n${pitchText(p.pitch)}`);
    for (const c of (p.citations ?? []) as Citation[]) {
      citations.push({ id: c.id, label: c.label, page: c.page, quote: c.quote, url: urlFor(data, c.reportVersionId) });
    }
  } else {
    lines.push(`\nNo published prediction yet: ${data.pendingNote ?? "reports are pending review"}. Do not state a target price.`);
  }

  if (data.history.length) {
    lines.push(`\nANNUAL FIGURES (${cur} million unless per share):`);
    for (const h of data.history.slice(-5)) {
      const m = (v: number | null) => (v === null ? "n/a" : (v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 }));
      lines.push(
        `FY${h.year}: revenue ${m(h.revenue)}, net income ${m(h.netIncome)}, EPS ${h.eps?.toFixed(2) ?? "n/a"}, DPS ${h.dps?.toFixed(2) ?? "n/a"}, equity ${m(h.totalEquity)}, debt ${m(h.totalDebt)}`,
      );
    }
  }

  if (citations.length) {
    lines.push("\nSOURCES:");
    for (const c of citations) lines.push(`${c.id}: [${c.label}] ${c.quote ? cut(c.quote, 300) : ""}`);
  }

  // Approved customer-evidence findings (PLAN2): context for the case, never an input to the numbers.
  const evidence = p?.pitch?.customerEvidence ?? [];
  if (evidence.length || examples.length) {
    const appendix = evidence.find((e) => e.appendixPath)?.appendixPath ?? null;
    lines.push("\nCUSTOMER EVIDENCE (exploratory sample of public customer accounts; not representative; does not affect the prediction):");
    let n = 1;
    for (const e of evidence) {
      const id = `E${n++}`;
      citations.push({ id, label: e.attribution, page: null, quote: e.text, url: appendix });
      lines.push(`${id}: [${e.attribution}] ${e.text}`);
    }
    for (const x of examples) {
      const id = `E${n++}`;
      citations.push({ id, label: `Example customer account, ${x.entity}`, page: null, quote: cut(x.text, 300), url: appendix });
      lines.push(`${id}: [Example account, ${x.entity}, ${x.platform}, paraphrased] ${cut(x.text, 400)}`);
    }
  }

  const passages = retrieved.map((r, i) => {
    const id = `R${startIndex + i}`;
    const label = `${r.title.replace(/ Report$/, "")}${r.page ? `, p.${r.page}` : ""}`;
    citations.push({ id, label, page: r.page, quote: cut(r.content, 400), url: urlFor(data, r.reportVersionId) });
    return `${id}: [${label}] ${cut(r.content, 900)}`;
  });
  if (passages.length) lines.push("\nREPORT PASSAGES (retrieved for this question):", ...passages);

  return { context: lines.join("\n"), citations };
}

export function urlFor(data: CompanyPageData, versionId: string | null): string | null {
  if (!versionId) return null;
  return data.reports.find((r) => r.versionId === versionId)?.url ?? null;
}

/** Ids like [S3], [R2] or [E1] mentioned in an answer. */
export function citedIds(text: string): string[] {
  return [...new Set([...text.matchAll(/\[([SRE]\d{1,3})\]/g)].map((m) => m[1]))];
}
