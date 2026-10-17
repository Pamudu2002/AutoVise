"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Disclaimer, UpsideBadge } from "@/components/ui/figures";
import { fmtMonthYear, money, multiple, num, pct, signedMoney, signedPct } from "@/lib/format";
import { runScenario } from "@/lib/valuation/scenarios";
import type { Assumptions, Levers } from "@/lib/valuation/types";

/**
 * What-if simulator. Runs the same runScenario() the engine used for the published target, in the
 * browser, so moving a slider shows exactly how the model responds. Nothing is saved.
 */
export function Simulator({ a, currency, disclaimer }: { a: Assumptions; currency: string; disclaimer: string }) {
  const base = a.baseLevers;
  const [lv, setLv] = useState<Levers>(base);
  const m = a.model;

  const user = useMemo(() => runScenario(m, lv), [m, lv]);
  const baseRun = useMemo(() => runScenario(m, base), [m, base]);
  const userPrices = [m.price, ...user.rows.map((r) => r.price)];
  const basePrices = [m.price, ...baseRun.rows.map((r) => r.price)];
  const target = userPrices[3];
  const diff = target - basePrices[3];
  const isBase = lv.growth === base.growth && lv.exitPe === base.exitPe && lv.tilt === base.tilt;
  const horizon = new Date(a.horizonDate + "T00:00:00Z");
  const yearLabel = (n: number) => {
    const d = new Date(horizon);
    d.setUTCFullYear(d.getUTCFullYear() - 3 + n);
    return `Y${n} · ${fmtMonthYear(d)}`;
  };

  const chart = ["Today", "Y1", "Y2", "Y3"].map((x, i) => ({ x, user: userPrices[i], base: basePrices[i] }));
  const tiltEffect = user.tiltPct;
  const round = (v: number, step: number) => Math.round(v / step) * step;

  return (
    <div role="tabpanel" aria-label="What-if Simulator" className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 560 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>What-if Simulator</h3>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Change the three levers behind the target and watch the projection move. Your scenario stays on this page; it is never saved or published.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setLv(base)} disabled={isBase}>
          <RotateCcw size={14} aria-hidden />
          Reset to AutoVise base case
        </button>
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 24 }}>
          <Slider
            id="s-g"
            label="EPS growth, first year"
            value={round(lv.growth * 100, 0.5)}
            display={pct(lv.growth)}
            min={Math.round(m.minGrowth * 100)}
            max={Math.round(m.maxGrowth * 100)}
            step={0.5}
            hints={[pct(m.minGrowth, 0), `Base ${pct(base.growth)}`, pct(m.maxGrowth, 0)]}
            onChange={(v) => setLv({ ...lv, growth: v / 100 })}
            help={`Then eases toward the sector's ${pct(m.sectorGrowth)} each year.`}
          />
          <Slider
            id="s-pe"
            label="Exit P/E"
            value={round(lv.exitPe, 0.1)}
            display={multiple(lv.exitPe)}
            min={m.minExitPe}
            max={m.maxExitPe}
            step={0.1}
            hints={[multiple(m.minExitPe), `Base ${multiple(base.exitPe)}`, multiple(m.maxExitPe)]}
            onChange={(v) => setLv({ ...lv, exitPe: v })}
            help={`Today ${multiple(m.pe0)}. Before the qualitative overlay.`}
          />
          <Slider
            id="s-t"
            label="Qualitative tilt"
            value={round(lv.tilt, 0.05)}
            display={signedPct(tiltEffect)}
            min={-1}
            max={1}
            step={0.05}
            hints={["Weakest", `Base ${signedPct(baseRun.tiltPct)}`, "Strongest"]}
            onChange={(v) => setLv({ ...lv, tilt: v })}
            help={`Factor composite ${num((lv.tilt + 1) * 50, 0)}/100; capped at ±${pct(m.tiltCap, 0)} of the price.`}
          />
        </div>

        <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ padding: 16, borderRadius: 12, background: "var(--subtle)", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Your 3-yr target</span>
              <span className="num" style={{ fontSize: 28, fontWeight: 600 }} aria-live="polite">
                {money(target, currency)}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>vs today</span>
              <UpsideBadge value={target / m.price - 1} large label="Change versus today" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>vs AutoVise base</span>
              <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>
                {Math.abs(diff) < 0.005 ? "Matches base" : signedMoney(diff, currency)}
              </span>
            </div>
          </div>

          <div role="img" aria-label={`Your scenario reaches ${money(target, currency)} in year 3, against the AutoVise base of ${money(basePrices[3], currency)}.`} style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="x" tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--mono)" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--mono)" }}
                  tickFormatter={(v: number) => num(v, v >= 100 ? 0 : 1)}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Line dataKey="base" stroke="var(--c5)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                <Line dataKey="user" stroke="var(--c1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--c1)" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 2, background: "var(--c1)" }} />
              Your scenario
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, borderTop: "2px dashed var(--c5)" }} />
              AutoVise base
            </span>
          </div>
          <div className="tbl-box" style={{ borderRadius: 10 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Year</th>
                  <th className="r">EPS</th>
                  <th className="r">P/E</th>
                  <th className="r">Price</th>
                </tr>
              </thead>
              <tbody>
                {user.rows.map((r) => (
                  <tr key={r.year}>
                    <td>{yearLabel(r.year)}</td>
                    <td className="r num">{num(r.eps)}</td>
                    <td className="r num">{multiple(r.pe)}</td>
                    <td className="r num" style={{ fontWeight: 600 }}>
                      {money(r.price, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Disclaimer text={disclaimer} icon={false} />
    </div>
  );
}

function Slider(p: { id: string; label: string; value: number; display: string; min: number; max: number; step: number; hints: string[]; help?: string; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <label className="label" htmlFor={p.id}>
          {p.label}
        </label>
        <span className="num" style={{ fontWeight: 600 }}>
          {p.display}
        </span>
      </div>
      <input id={p.id} type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(parseFloat(e.target.value))} aria-valuetext={p.display} />
      <div style={{ display: "flex", justifyContent: "space-between" }} className="hint num">
        {p.hints.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {p.help && <span className="hint">{p.help}</span>}
    </div>
  );
}
