"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SourceDialog, type CiteSource } from "@/components/citation";
import { FinancialsTab } from "@/components/financials-tab";
import { HowWeGotHere } from "@/components/how-we-got-here";
import { PitchSections } from "@/components/pitch-sections";
import { Simulator } from "@/components/simulator";
import type { CompanyPageData } from "@/lib/data/public";
import { fmtDate } from "@/lib/format";

const TABS = [
  { key: "pitch", label: "The Pitch" },
  { key: "how", label: "How We Got Here" },
  { key: "financials", label: "Financials" },
  { key: "whatif", label: "What-if Simulator" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function CompanyTabs({ data, disclaimer }: { data: CompanyPageData; disclaimer: string }) {
  const p = data.prediction;
  const available = TABS.filter((t) => (p ? true : t.key === "financials"));
  const [tab, setTab] = useState<Tab>(p ? "pitch" : "financials");
  const [source, setSource] = useState<CiteSource | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Deep links: /companies/lhl#how
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (available.some((t) => t.key === h)) setTab(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  const sources = useMemo(() => {
    const map = new Map<string, CiteSource>();
    for (const c of p?.citations ?? []) {
      const r = data.reports.find((x) => x.versionId === c.reportVersionId);
      map.set(c.id, {
        id: c.id,
        label: c.label,
        page: c.page,
        quote: c.quote,
        section: c.section ?? null,
        url: r?.url ?? null,
        doc: r?.title ?? null,
        version: r ? `Version ${r.versionNo}${r.approvedAt ? ` · approved ${fmtDate(r.approvedAt)}` : ""}` : null,
      });
    }
    return map;
  }, [p, data.reports]);

  const epsReport = p ? data.reports.find((r) => r.type === "annual" && r.fiscalPeriod.includes(String(p.assumptions.epsYear))) : null;
  const epsSource: CiteSource | null = epsReport
    ? { id: "eps", label: epsReport.title.replace(/ Report$/, ""), page: null, quote: `Basic earnings per share for FY${p!.assumptions.epsYear}.`, url: epsReport.url, doc: epsReport.title, version: `Version ${epsReport.versionNo}` }
    : null;

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + available.length) % available.length;
    go(available[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="tabs" role="tablist" aria-label="Pitch sections">
        {available.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`tab${tab === t.key ? " on" : ""}`}
            role="tab"
            aria-selected={tab === t.key}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => go(t.key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pitch" && p?.pitch && (
        <PitchSections
          pitch={p.pitch}
          sources={sources}
          bear={p.scenarios.bear.y3}
          bull={p.scenarios.bull.y3}
          currency={data.company.currency}
          onCite={setSource}
          onWalkthrough={() => go("how")}
          disclaimer={disclaimer}
        />
      )}
      {tab === "how" && p && (
        <HowWeGotHere
          a={p.assumptions}
          waterfall={p.valuationBreakdown}
          factors={p.factorScores}
          currency={data.company.currency}
          ticker={data.company.ticker}
          epsSource={epsSource}
          onCite={setSource}
          disclaimer={disclaimer}
          evidencePath={p.pitch?.customerEvidence?.find((e) => e.appendixPath)?.appendixPath ?? null}
        />
      )}
      {tab === "financials" && <FinancialsTab history={data.history} reports={data.reports} currency={data.company.currency} />}
      {tab === "whatif" && p && <Simulator a={p.assumptions} currency={data.company.currency} disclaimer={disclaimer} />}

      <SourceDialog source={source} onClose={() => setSource(null)} />
    </div>
  );
}
