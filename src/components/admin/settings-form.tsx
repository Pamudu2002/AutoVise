"use client";

import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminMain, PageHeader } from "@/components/admin/page-header";
import { useAction } from "@/components/admin/use-action";
import { Switch } from "@/components/ui/fields";
import { saveSettings } from "@/lib/actions/settings";
import type { AppSettings } from "@/lib/settings";
import { FACTOR_KEYS, FACTOR_LABELS } from "@/lib/valuation/types";

type Num = { path: string; label: string; unit: string; hint: string; pct?: boolean; step?: number };

const get = (o: unknown, path: string): number => path.split(".").reduce((x: unknown, k) => (x as Record<string, unknown>)[k], o) as number;
function set<T>(o: T, path: string, v: unknown): T {
  const copy = structuredClone(o);
  const keys = path.split(".");
  let cur = copy as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = v;
  return copy;
}

const CAPS: Num[] = [
  { path: "valuation.maxGrowth", label: "Max EPS growth", unit: "% per year", hint: "Growth above this is clipped.", pct: true },
  { path: "valuation.minGrowth", label: "Min EPS growth", unit: "% per year", hint: "Declines below this are clipped.", pct: true },
  { path: "valuation.maxExitPe", label: "Max exit P/E", unit: "×", hint: "Applies to every sector." },
  { path: "valuation.minExitPe", label: "Min exit P/E", unit: "×", hint: "Floor for the exit multiple." },
  { path: "valuation.tiltCap", label: "Qualitative tilt cap", unit: "± %", hint: "Largest price effect factor scores can make.", pct: true },
  { path: "valuation.qualGrowthCap", label: "Qualitative growth shift", unit: "± pp", hint: "Largest growth shift from factor scores.", pct: true },
  { path: "valuation.qualMultipleCap", label: "Qualitative multiple shift", unit: "± %", hint: "Largest exit P/E shift from factor scores.", pct: true },
  { path: "publishing.minConfidenceToPublish", label: "Min confidence to publish", unit: "/ 100", hint: "Below this, a prediction stays as Pending." },
];

const MODEL: Num[] = [
  { path: "valuation.growthWeights.historical", label: "Weight: EPS record", unit: "%", hint: "Share of the growth blend.", pct: true },
  { path: "valuation.growthWeights.sustainable", label: "Weight: sustainable growth", unit: "%", hint: "ROE × retention.", pct: true },
  { path: "valuation.growthWeights.sector", label: "Weight: sector benchmark", unit: "%", hint: "Sector long-run growth.", pct: true },
  { path: "valuation.meanReversion", label: "Mean reversion", unit: "% per year", hint: "Gap to sector growth closed each year.", pct: true },
  { path: "valuation.peConvergence", label: "P/E convergence", unit: "%", hint: "How far the exit P/E moves toward the sector.", pct: true },
  { path: "valuation.scenario.growthShift", label: "Scenario growth shift", unit: "± pp", hint: "Bear and bull growth difference.", pct: true },
  { path: "valuation.scenario.peShift", label: "Scenario P/E shift", unit: "± %", hint: "Bear and bull multiple difference.", pct: true },
  { path: "valuation.dcf.weight", label: "DCF weight", unit: "%", hint: "Share of the target from discounted cash flow. 0 turns it off.", pct: true },
  { path: "valuation.dcf.fadeYears", label: "DCF fade period", unit: "years", hint: "Years for growth to fade to the terminal rate." },
  { path: "valuation.ddm.weight", label: "Dividend cross-check weight", unit: "%", hint: "0 turns the dividend model off.", pct: true },
  { path: "valuation.costOfEquity", label: "Cost of equity", unit: "%", hint: "Discount rate for DCF and dividends.", pct: true },
  { path: "valuation.terminalGrowthCap", label: "Terminal growth cap", unit: "%", hint: "Long-run growth limit after the fade.", pct: true },
];

function NumField({ s, value, onChange, disabled }: { s: Num; value: number; onChange: (v: number) => void; disabled: boolean }) {
  const [text, setText] = useState(String(s.pct ? +(value * 100).toFixed(2) : value));
  useEffect(() => setText(String(s.pct ? +(value * 100).toFixed(2) : value)), [value, s.pct]);
  const id = `f-${s.path}`;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {s.label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id={id}
          className="input num"
          style={{ width: 120, textAlign: "right" }}
          value={text}
          inputMode="decimal"
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(s.pct ? n / 100 : n);
          }}
        />
        <span className="muted">{s.unit}</span>
      </div>
      <span className="hint">{s.hint}</span>
    </div>
  );
}

/** Settings (Settings.dc.html): score weights, guard-rails, publishing rules and disclaimer text. */
export function SettingsForm({ initial, canEdit }: { initial: AppSettings; canEdit: boolean }) {
  const [s, setS] = useState(initial);
  const [base, setBase] = useState(initial);
  const { exec, pending } = useAction();
  const dirty = JSON.stringify(s) !== JSON.stringify(base);
  const w = s.valuation.scoreWeights;
  const total = w.upside + w.quality + w.confidence;
  const gw = s.valuation.growthWeights;
  const gTotal = Math.round((gw.historical + gw.sustainable + gw.sector) * 100);
  const peShare = Math.round((1 - s.valuation.dcf.weight - s.valuation.ddm.weight) * 100);
  const bad = total !== 100 || peShare < 10;
  const upd = (path: string, v: unknown) => setS((x) => set(x, path, v));

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    const res = await exec(() => saveSettings(s));
    if (res.ok) setBase(s);
  };

  return (
    <AdminMain max={920} gap={24}>
      <div style={{ paddingBottom: 72, display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader title="Settings" sub="Model weights, guard-rails and publishing rules. Valuation changes apply to the next recalculation of every company." />
        {!canEdit && (
          <div role="status" style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: "var(--info-soft)", fontSize: 13 }}>
            <Info size={16} style={{ color: "var(--info)" }} aria-hidden />
            Only admins can change settings. You can view them here.
          </div>
        )}

        <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }} aria-labelledby="w-h">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 id="w-h" style={{ fontSize: 16, fontWeight: 600 }}>
                AutoVise Score weights
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>How the 0–100 score blends upside, quality and confidence. Must add up to 100.</p>
            </div>
            <span className={total !== 100 ? "pill pill-failed" : "pill pill-approved"}>Total {total}</span>
          </div>
          {(
            [
              ["upside", "Upside to base case", "Bigger upside scores higher"],
              ["quality", "Qualitative quality", "Average of the six factors"],
              ["confidence", "Confidence", "Data completeness, recency and agreement"],
            ] as const
          ).map(([k, label, hint]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 200px) minmax(0, 1fr) 96px", gap: 16, alignItems: "center" }}>
              <label className="label" htmlFor={`w-${k}-r`}>
                {label}
                <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: "var(--muted)" }}>{hint}</span>
              </label>
              <input id={`w-${k}-r`} type="range" min={0} max={100} step={5} value={w[k]} disabled={!canEdit} onChange={(e) => upd(`valuation.scoreWeights.${k}`, Number(e.target.value))} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label htmlFor={`w-${k}-n`} className="sr-only">
                  {label} weight
                </label>
                <input id={`w-${k}-n`} className="input num" style={{ height: 36, textAlign: "right" }} value={w[k]} inputMode="numeric" disabled={!canEdit} onChange={(e) => upd(`valuation.scoreWeights.${k}`, Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
                <span className="muted">%</span>
              </div>
            </div>
          ))}
          {total !== 100 && (
            <span className="err" role="alert">
              Weights add up to {total}. Adjust them to 100 to save.
            </span>
          )}
        </section>

        <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }} aria-labelledby="c-h">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 id="c-h" style={{ fontSize: 16, fontWeight: 600 }}>
              Valuation guard-rails
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Hard limits the model can&apos;t exceed, whatever the reports say.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {CAPS.map((c) => (
              <NumField key={c.path} s={c} value={get(s, c.path)} onChange={(v) => upd(c.path, v)} disabled={!canEdit} />
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }} aria-labelledby="m-h">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 id="m-h" style={{ fontSize: 16, fontWeight: 600 }}>
                Model parameters
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Growth blend, mean reversion, scenarios and the dividend cross-check. The growth weights are normalised automatically.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill pill-draft">Growth weights {gTotal}%</span>
              <span className={peShare < 10 ? "pill pill-failed" : "pill pill-draft"}>P/E method {peShare}%</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {MODEL.map((c) => (
              <NumField key={c.path} s={c} value={get(s, c.path)} onChange={(v) => upd(c.path, v)} disabled={!canEdit} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="label">Factor weights in the qualitative composite</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 12 }}>
              {FACTOR_KEYS.map((k) => (
                <NumField key={k} s={{ path: `valuation.factorWeights.${k}`, label: FACTOR_LABELS[k], unit: "×", hint: "0 ignores this factor." }} value={s.valuation.factorWeights[k]} onChange={(v) => upd(`valuation.factorWeights.${k}`, v)} disabled={!canEdit} />
              ))}
            </div>
          </div>
        </section>

        <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }} aria-labelledby="p-h">
          <h2 id="p-h" style={{ fontSize: 16, fontWeight: 600 }}>
            Publishing and review
          </h2>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Switch on={s.publishing.autoPublish} onChange={(v) => upd("publishing.autoPublish", v)} labelledBy="ap-l" describedBy="ap-d" disabled={!canEdit} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span id="ap-l" style={{ fontWeight: 500 }}>
                Auto-publish small changes
              </span>
              <span id="ap-d" className="hint" style={{ fontSize: 13 }}>
                When on, a recalculated prediction goes live without review if it stays within the limits below. Larger changes always wait for a reviewer.
              </span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16, padding: 16, borderRadius: 12, background: "var(--subtle)", opacity: s.publishing.autoPublish ? 1 : 0.6 }}>
            <NumField s={{ path: "publishing.maxChange", label: "Max change in base target", unit: "%", hint: "Auto-publish only below this move.", pct: true }} value={s.publishing.maxChange} onChange={(v) => upd("publishing.maxChange", v)} disabled={!canEdit || !s.publishing.autoPublish} />
            <NumField s={{ path: "publishing.autoMinConfidence", label: "Min confidence", unit: "/ 100", hint: "Auto-publish only at or above this." }} value={s.publishing.autoMinConfidence} onChange={(v) => upd("publishing.autoMinConfidence", Math.round(v))} disabled={!canEdit || !s.publishing.autoPublish} />
            <NumField s={{ path: "publishing.stalePriceDays", label: "Mark prices stale after", unit: "trading days", hint: "Shown on the dashboard." }} value={s.publishing.stalePriceDays} onChange={(v) => upd("publishing.stalePriceDays", Math.round(v))} disabled={!canEdit} />
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Switch on={s.extraction.autoApprove} onChange={(v) => upd("extraction.autoApprove", v)} labelledBy="aa-l" describedBy="aa-d" disabled={!canEdit} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span id="aa-l" style={{ fontWeight: 500 }}>
                Approve extracted data automatically
              </span>
              <span id="aa-d" className="hint" style={{ fontSize: 13 }}>
                Skips the review step for new reports. Leave off unless you trust the extraction for these companies.
              </span>
            </div>
          </div>
        </section>

        <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }} aria-labelledby="ch-h">
          <h2 id="ch-h" style={{ fontSize: 16, fontWeight: 600 }}>
            Consultant chat limits
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16 }}>
            <NumField s={{ path: "chat.perIpPerHour", label: "Questions per IP", unit: "per hour", hint: "Protects the Gemini key." }} value={s.chat.perIpPerHour} onChange={(v) => upd("chat.perIpPerHour", Math.round(v))} disabled={!canEdit} />
            <NumField s={{ path: "chat.perSessionPerHour", label: "Questions per visitor", unit: "per hour", hint: "Per browser session." }} value={s.chat.perSessionPerHour} onChange={(v) => upd("chat.perSessionPerHour", Math.round(v))} disabled={!canEdit} />
          </div>
        </section>

        <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }} aria-labelledby="d-h">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 id="d-h" style={{ fontSize: 16, fontWeight: 600 }}>
              Disclaimer text
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Shown wherever a prediction appears, and in the footer.</p>
          </div>
          <div className="field">
            <label className="label" htmlFor="d-short">
              Short line
            </label>
            <input id="d-short" className="input" value={s.disclaimer.short} maxLength={90} disabled={!canEdit} onChange={(e) => upd("disclaimer.short", e.target.value)} />
            <span className="hint tnum">{s.disclaimer.short.length} / 90 characters</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="d-long">
              Footer disclaimer
            </label>
            <textarea id="d-long" className="textarea" rows={4} value={s.disclaimer.long} maxLength={1200} disabled={!canEdit} onChange={(e) => upd("disclaimer.long", e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px", borderRadius: 10, background: "var(--subtle)" }}>
            <span className="eyebrow">Preview</span>
            <span className="disclaimer">
              <Info size={14} aria-hidden />
              {s.disclaimer.short}
            </span>
          </div>
        </section>
      </div>

      {dirty && canEdit && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 50, display: "flex", gap: 16, alignItems: "center", padding: "10px 10px 10px 18px", borderRadius: 14, background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }} role="region" aria-label="Unsaved changes">
          <span style={{ fontSize: 14, fontWeight: 500 }}>Unsaved changes</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setS(base)}>
            Discard
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={bad || pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </AdminMain>
  );
}
