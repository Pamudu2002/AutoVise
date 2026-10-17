"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronRight } from "lucide-react";
import { CitationChip, type CiteSource } from "@/components/citation";
import { Disclaimer } from "@/components/ui/figures";
import type { Pitch } from "@/lib/ai/schemas";
import { money } from "@/lib/format";

interface Props {
  pitch: Pitch;
  sources: Map<string, CiteSource>;
  bear: number;
  bull: number;
  currency: string;
  onCite: (s: CiteSource) => void;
  onWalkthrough: () => void;
  disclaimer: string;
}

/** "The Pitch" tab: thesis, drivers, valuation walkthrough, risks, catalysts, what would change our view. */
export function PitchSections({ pitch, sources, bear, bull, currency, onCite, onWalkthrough, disclaimer }: Props) {
  const chips = (ids: string[], block?: boolean) =>
    ids
      .map((id) => sources.get(id))
      .filter((s): s is CiteSource => !!s)
      .map((s) => (
        <span key={s.id} style={block ? { alignSelf: "flex-start" } : { marginLeft: 6 }}>
          <CitationChip source={s} onOpen={onCite} />
        </span>
      ));
  const figureColor = (f: string) => (/^[−-]/.test(f.trim()) ? "var(--neg)" : "var(--pos)");

  return (
    <article className="card" role="tabpanel" aria-label="The Pitch" style={{ padding: "clamp(20px, 4vw, 32px)", display: "flex", flexDirection: "column", gap: 36 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
        <span className="eyebrow">01 · Investment thesis</span>
        <h3 style={{ fontSize: 22, lineHeight: 1.3, fontWeight: 600 }}>{pitch.thesis.headline}</h3>
        {pitch.thesis.paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 15.5, lineHeight: 1.7, color: i > 0 ? "var(--muted)" : undefined }}>
            {p.text}
            {chips(p.cites)}
          </p>
        ))}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="eyebrow">02 · Key drivers</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
          {pitch.drivers.map((d, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, border: "1px solid var(--border)", borderRadius: 12 }}>
              {d.figure && (
                <span className="num" style={{ fontSize: 24, fontWeight: 600, color: figureColor(d.figure) }}>
                  {d.figure}
                </span>
              )}
              <span style={{ fontWeight: 600 }}>{d.title}</span>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{d.body}</p>
              {chips(d.cites, true)}
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
        <span className="eyebrow">03 · Valuation walkthrough</span>
        {pitch.valuation.paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 15.5, lineHeight: 1.7 }}>
            {p.text}
          </p>
        ))}
        <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={onWalkthrough}>
          See the full walkthrough
          <ChevronRight size={14} aria-hidden />
        </button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 24 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="eyebrow">04 · Risks</span>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
            {pitch.risks.map((r, i) => (
              <li key={i} style={{ display: "flex", gap: 10 }}>
                <AlertTriangle size={16} style={{ color: "var(--neg)", flex: "none", marginTop: 3 }} aria-hidden />
                <div style={{ lineHeight: 1.6 }}>
                  {r.title && <strong style={{ fontWeight: 600 }}>{r.title}. </strong>}
                  {r.body}
                  {chips(r.cites)}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="eyebrow">05 · Catalysts</span>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
            {pitch.catalysts.map((r, i) => (
              <li key={i} style={{ display: "flex", gap: 10 }}>
                <CalendarDays size={16} style={{ color: "var(--accent)", flex: "none", marginTop: 3 }} aria-hidden />
                <div style={{ lineHeight: 1.6 }}>
                  {r.title && <strong style={{ fontWeight: 600 }}>{r.title}. </strong>}
                  {r.body}
                  {chips(r.cites)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="eyebrow">06 · What would change our view</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 12, background: "var(--pos-soft)", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600, color: "var(--pos)" }}>
              <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden />
              Toward the bull case · {money(bull, currency)}
            </span>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{pitch.changeView.bull}</p>
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: "var(--neg-soft)", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600, color: "var(--neg)" }}>
              <ArrowDownRight size={16} strokeWidth={2.4} aria-hidden />
              Toward the bear case · {money(bear, currency)}
            </span>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{pitch.changeView.bear}</p>
          </div>
        </div>
      </section>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Disclaimer text={disclaimer} icon={false} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {pitch.generatedBy === "gemini" ? "Written by Gemini from the computed figures; every number is checked against the inputs." : "Written from the computed figures and report extracts."}
        </span>
      </div>
    </article>
  );
}
