"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { CompanyLogo } from "@/components/company-logo";
import { Disclaimer } from "@/components/ui/figures";
import { Select } from "@/components/ui/fields";
import type { Checkpoint } from "@/lib/data/insights";
import { fmtDate, fmtMonthYear, money, num, signedPct } from "@/lib/format";

type Outcome = "all" | "hit" | "miss";
const chg = (v: number, s: number) => v / s - 1;

/** Predicted vs actual at each 12-month checkpoint, as a dumbbell chart and a table. */
export function TrackRecordView({ resolved, open, disclaimer }: { resolved: Checkpoint[]; open: Checkpoint[]; disclaimer: string }) {
  const [co, setCo] = useState("All companies");
  const [oc, setOc] = useState<Outcome>("all");
  const companies = ["All companies", ...[...new Set(resolved.map((r) => r.company.ticker))].sort()];
  const rows = resolved.filter((r) => (co === "All companies" || r.company.ticker === co) && (oc === "all" || (oc === "hit" ? r.hit : !r.hit)));

  const stats = useMemo(() => {
    const n = resolved.length;
    const hits = resolved.filter((r) => r.hit).length;
    const dir = resolved.filter((r) => r.directionOk).length;
    const errs = resolved.map((r) => Math.abs(r.error ?? 0)).sort((a, b) => a - b);
    const median = errs.length ? (errs.length % 2 ? errs[(errs.length - 1) / 2] : (errs[errs.length / 2 - 1] + errs[errs.length / 2]) / 2) : null;
    const due = open.map((o) => o.due).sort();
    return { n, hits, dir, median, openFrom: due[0], openTo: due[due.length - 1] };
  }, [resolved, open]);

  const data = rows.map((r) => {
    const vals = [chg(r.low, r.start), chg(r.high, r.start), chg(r.predicted, r.start), chg(r.actual!, r.start)];
    return { r, label: r.id, range: [Math.min(...vals), Math.max(...vals)] as [number, number], low: vals[0], high: vals[1], pred: vals[2], act: vals[3] };
  });
  const all = data.flatMap((d) => d.range);
  const lo = Math.min(-0.1, ...all) - 0.03;
  const hi = Math.max(0.1, ...all) + 0.03;
  const firstOpen = resolved.length ? null : stats.openFrom;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / 0.15) * 0.15; t <= hi + 1e-9; t += 0.15) ticks.push(Math.round(t * 100) / 100);

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760 }}>
        <h1 style={{ fontSize: 32, fontWeight: 600 }}>Track record</h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6 }}>
          Every 12-month checkpoint we have published, scored against what the share price actually did. A prediction is a hit when the actual price lands inside its bear–bull band.
          {firstOpen ? ` Our first checkpoints resolve in ${fmtMonthYear(firstOpen)}.` : ""}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16 }}>
        <Stat label="Hit rate" value={stats.n ? `${Math.round((stats.hits / stats.n) * 100)}%` : "—"} note={`${stats.hits} of ${stats.n} inside the band`} />
        <Stat label="Direction correct" value={stats.n ? `${Math.round((stats.dir / stats.n) * 100)}%` : "—"} note="Called up or down correctly" />
        <Stat label="Median absolute error" value={stats.median === null ? "—" : `${num(stats.median * 100, 1)}%`} note="Actual vs predicted base price" />
        <Stat label="Still open" value={String(open.length)} note={open.length ? `Checkpoints due ${fmtMonthYear(stats.openFrom)} – ${fmtMonthYear(stats.openTo)}` : "No open checkpoints"} />
      </div>

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Predicted vs actual, at each checkpoint</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Change from the price on the day each prediction was published.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ width: 200 }}>
              <label className="label" htmlFor="tr-co">
                Company
              </label>
              <Select id="tr-co" value={co} onChange={(e) => setCo(e.target.value)}>
                {companies.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </div>
            <div className="seg" role="group" aria-label="Outcome filter">
              {(["all", "hit", "miss"] as const).map((k) => (
                <button key={k} className={`seg-btn${oc === k ? " on" : ""}`} aria-pressed={oc === k} onClick={() => setOc(k)} style={{ padding: "0 12px" }}>
                  {k === "all" ? "All" : k === "hit" ? "Hits" : "Misses"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 18, height: 8, borderRadius: 4, background: "var(--band)" }} />
            Bear–bull band
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, transform: "rotate(45deg)", border: "2px solid var(--c1)", background: "var(--card)" }} />
            Predicted base
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--pos)" }} />
            Actual — hit
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--neg)" }} />
            Actual — miss
          </span>
        </div>
        {rows.length === 0 ? (
          <p style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)" }}>{resolved.length ? "No checkpoints match these filters." : "No checkpoints have resolved yet."}</p>
        ) : (
          <div role="img" aria-label={`Dumbbell chart of ${rows.length} checkpoints: ${rows.filter((r) => r.hit).length} hits and ${rows.filter((r) => !r.hit).length} misses.`} style={{ width: "100%", height: data.length * 48 + 40 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barCategoryGap={8}>
                <XAxis type="number" domain={[lo, hi]} ticks={ticks} orientation="top" tickFormatter={(v: number) => signedPct(v, 0)} tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--mono)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={180} axisLine={false} tickLine={false} tick={<RowTick rows={data.map((d) => d.r)} />} />
                <ReferenceLine x={0} stroke="var(--border-strong)" />
                <Bar dataKey="range" isAnimationActive={false} shape={<Dumbbell />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="tbl-box">
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Company</th>
              <th>Published</th>
              <th className="r">Price then</th>
              <th className="r">Predicted</th>
              <th className="r">Band</th>
              <th className="r">Actual</th>
              <th className="r">Error</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <CompanyLogo {...r.company} size={32} decorative />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 500 }}>{r.company.name}</span>
                      <span className="num muted" style={{ fontSize: 12 }}>
                        {r.company.ticker} · {r.year * 12} m checkpoint
                      </span>
                    </div>
                  </div>
                </td>
                <td className="tnum">{fmtDate(r.made)}</td>
                <td className="r num">{money(r.start, r.currency)}</td>
                <td className="r num">{money(r.predicted, r.currency)}</td>
                <td className="r num muted">
                  {num(r.low)}–{num(r.high)}
                </td>
                <td className="r num" style={{ fontWeight: 600 }}>
                  {money(r.actual, r.currency)}
                </td>
                <td className="r num">{signedPct(r.error)}</td>
                <td>
                  <span className={`pill ${r.hit ? "pill-approved" : "pill-failed"}`}>{r.hit ? "Hit" : "Miss"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Disclaimer text={`Past accuracy does not guarantee future results. ${disclaimer}`} icon={false} />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
      <span className="num" style={{ fontSize: 30, fontWeight: 600 }}>
        {value}
      </span>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{note}</span>
    </div>
  );
}

function RowTick(props: { x?: number; y?: number; payload?: { value: string }; rows: Checkpoint[] }) {
  const r = props.rows.find((x) => x.id === props.payload?.value);
  if (!r) return null;
  return (
    <g transform={`translate(${(props.x ?? 0) - 172},${props.y ?? 0})`}>
      <text y={-3} fontSize={13} fontWeight={600} fill="var(--text)" fontFamily="var(--mono)">
        {r.company.ticker}
      </text>
      <text y={12} fontSize={11.5} fill="var(--muted)">
        {fmtDate(r.made)} · {r.year * 12} m
      </text>
    </g>
  );
}

function Dumbbell(props: { x?: number; y?: number; width?: number; height?: number; payload?: { range: [number, number]; low: number; high: number; pred: number; act: number; r: Checkpoint } }) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;
  const [a, b] = payload.range;
  const px = (v: number) => x + (b === a ? 0 : ((v - a) / (b - a)) * width);
  const cy = y + height / 2;
  const hit = payload.r.hit;
  const [l1, l2] = [px(Math.min(payload.pred, payload.act)), px(Math.max(payload.pred, payload.act))];
  return (
    <g>
      <rect x={px(payload.low)} y={cy - 6} width={Math.max(2, px(payload.high) - px(payload.low))} height={12} rx={6} fill="var(--band)" />
      <line x1={l1} x2={l2} y1={cy} y2={cy} stroke="var(--border-strong)" strokeWidth={1.5} />
      <rect x={px(payload.pred) - 5} y={cy - 5} width={10} height={10} transform={`rotate(45 ${px(payload.pred)} ${cy})`} fill="var(--card)" stroke="var(--c1)" strokeWidth={2} />
      <circle cx={px(payload.act)} cy={cy} r={6} fill={hit ? "var(--pos)" : "var(--neg)"} />
    </g>
  );
}
