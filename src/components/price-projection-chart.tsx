"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScenarioSet } from "@/lib/valuation/types";
import { money, num } from "@/lib/format";

interface Props {
  prices: { date: string; price: number }[];
  currency: string;
  /** Prediction scenarios and the date they start from (today). */
  scenarios?: ScenarioSet | null;
  start?: { date: string; price: number } | null;
  height?: number;
}

const YEAR = 365.25 * 86_400_000;
const t = (d: string) => new Date(d + (d.length === 10 ? "T00:00:00Z" : "")).getTime();
const monthYear = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(" ", " '");
const fullMonthYear = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

interface Row {
  t: number;
  hist?: number;
  base?: number;
  bear?: number;
  bull?: number;
  band?: [number, number];
}

/** History line, then a bear–bull fan for years 1–3 with the base case dashed (Company.dc.html). */
export function PriceProjectionChart({ prices, currency, scenarios, start, height = 340 }: Props) {
  const rows: Row[] = prices.map((p) => ({ t: t(p.date), hist: p.price }));
  const t0 = start ? t(start.date) : rows[rows.length - 1]?.t;
  const marks: { t: number; n: number }[] = [];
  if (scenarios && start && t0) {
    const pts = [
      { n: 0, base: start.price, bear: start.price, bull: start.price },
      { n: 1, base: scenarios.base.y1, bear: scenarios.bear.y1, bull: scenarios.bull.y1 },
      { n: 2, base: scenarios.base.y2, bear: scenarios.bear.y2, bull: scenarios.bull.y2 },
      { n: 3, base: scenarios.base.y3, bear: scenarios.bear.y3, bull: scenarios.bull.y3 },
    ];
    // Monthly points between the yearly targets so the fan reads as a smooth band.
    for (let m = 0; m <= 36; m++) {
      const f = m / 12;
      const k = Math.min(2, Math.floor(f));
      const r = f - k;
      const lerp = (key: "base" | "bear" | "bull") => pts[k][key] + (pts[k + 1][key] - pts[k][key]) * r;
      const row: Row = { t: t0 + f * YEAR, base: lerp("base"), bear: lerp("bear"), bull: lerp("bull") };
      row.band = [row.bear!, row.bull!];
      if (m === 0) {
        const last = rows[rows.length - 1];
        if (last && Math.abs(last.t - row.t) < 86_400_000 * 2) Object.assign(last, { ...row, t: last.t, hist: last.hist });
        else rows.push({ ...row, hist: start.price });
      } else rows.push(row);
    }
    for (let n = 1; n <= 3; n++) marks.push({ t: t0 + n * YEAR, n });
  }

  const tMin = rows[0]?.t ?? Date.now();
  const tMax = rows[rows.length - 1]?.t ?? Date.now();
  const values = rows.flatMap((r) => [r.hist, r.bear, r.bull].filter((v): v is number => v !== undefined));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = niceStep((hi - lo) / 5);
  const yMin = Math.max(0, Math.floor((lo - step * 0.3) / step) * step);
  const yMax = Math.ceil((hi + step * 0.3) / step) * step;
  // One tick a year, in the month of "today", like Oct '21 … Oct '29.
  const ticks: number[] = [];
  const month = new Date(t0 ?? tMax).getUTCMonth();
  for (let y = new Date(tMin).getUTCFullYear(); y <= new Date(tMax).getUTCFullYear(); y++) {
    const at = Date.UTC(y, month, 1);
    if (at >= tMin && at <= tMax) ticks.push(at);
  }

  const endBase = scenarios?.base.y3;
  const label = scenarios
    ? `Share price history, then a projected range to ${fullMonthYear(tMax)}: bear ${money(scenarios.bear.y3, currency)}, base ${money(scenarios.base.y3, currency)}, bull ${money(scenarios.bull.y3, currency)}.`
    : "Share price history.";

  return (
    <div role="img" aria-label={label} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 28, right: scenarios ? 92 : 16, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[tMin, tMax]}
            ticks={ticks}
            tickFormatter={monthYear}
            tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--mono)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickCount={6}
            tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--mono)" }}
            tickFormatter={(v: number) => num(v, v >= 100 ? 0 : 2)}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          {t0 && scenarios && <ReferenceArea x1={t0} x2={tMax} fill="var(--band-2)" ifOverflow="hidden" />}
          {scenarios && <Area dataKey="band" type="linear" stroke="none" fill="var(--band)" fillOpacity={1} isAnimationActive={false} activeDot={false} />}
          {marks.map((m) => (
            <ReferenceLine
              key={m.n}
              x={m.t}
              stroke="var(--border-strong)"
              strokeDasharray="3 4"
              label={{ value: `Y${m.n} · ${fullMonthYear(m.t)}`, position: "top", fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
            />
          ))}
          {t0 && scenarios && <ReferenceLine x={t0} stroke="transparent" label={{ value: "Today", position: "top", fill: "var(--muted)", fontSize: 11, fontWeight: 600 }} />}
          {scenarios && <Line dataKey="bull" type="linear" stroke="var(--pos)" strokeWidth={1.25} strokeDasharray="2 3" dot={false} activeDot={false} isAnimationActive={false} label={endLabel(rows.length, "Bull", "var(--pos)")} />}
          {scenarios && <Line dataKey="bear" type="linear" stroke="var(--neg)" strokeWidth={1.25} strokeDasharray="2 3" dot={false} activeDot={false} isAnimationActive={false} label={endLabel(rows.length, "Bear", "var(--neg)")} />}
          <Line dataKey="hist" type="linear" stroke="var(--c1)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          {scenarios && (
            <Line
              dataKey="base"
              type="linear"
              stroke="var(--c2)"
              strokeWidth={2.25}
              strokeDasharray="6 5"
              isAnimationActive={false}
              dot={yearDot(marks.map((m) => m.t))}
              label={endLabel(rows.length, "Base", "var(--text)")}
            />
          )}
          <Tooltip content={<ChartTip currency={currency} />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "2 3" }} />
        </ComposedChart>
      </ResponsiveContainer>
      {endBase === undefined ? null : <span className="sr-only">Base case {money(endBase, currency)}</span>}
    </div>
  );
}

function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Value label at the end of a scenario line, to the right of the plot. */
function endLabel(count: number, name: string, color: string) {
  // eslint-disable-next-line react/display-name
  return (p: { index?: number; x?: unknown; y?: unknown; value?: unknown }) => {
    if (p.index !== count - 1 || p.value === undefined || p.value === null) return <g />;
    return (
      <text x={Number(p.x) + 8} y={Number(p.y)} dy={4} fontSize={11} fontWeight={600} fill={color} fontFamily="var(--mono)">
        {name} {num(Number(p.value))}
      </text>
    );
  };
}

/** Dots and value labels on the base line at Y1 and Y2 (Y3 has the end label). */
function yearDot(times: number[]) {
  // eslint-disable-next-line react/display-name
  return (p: { cx?: number; cy?: number; payload?: Row; index?: number }) => {
    const at = p.payload && times.slice(0, 2).some((x) => Math.abs(x - p.payload!.t) < 86_400_000 * 20);
    if (!at || p.cx === undefined || p.cy === undefined || p.payload?.base === undefined) return <g key={p.index} />;
    return (
      <g key={p.index}>
        <rect x={p.cx - 26} y={p.cy - 27} width={52} height={17} rx={4} fill="var(--card)" />
        <text x={p.cx} y={p.cy - 15} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)" fontFamily="var(--mono)">
          {num(p.payload.base)}
        </text>
        <circle cx={p.cx} cy={p.cy} r={4.5} fill="var(--card)" stroke="var(--c2)" strokeWidth={2} />
      </g>
    );
  };
}

function ChartTip({ active, payload, currency }: { active?: boolean; payload?: { payload: Row }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="chart-tip">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{new Date(r.t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</div>
      {r.hist !== undefined && r.base === undefined && <div className="num">{money(r.hist, currency)}</div>}
      {r.base !== undefined && (
        <div className="num" style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 10 }}>
          <span style={{ color: "var(--pos)" }}>Bull</span>
          <span>{money(r.bull!, currency)}</span>
          <span>Base</span>
          <span>{money(r.base, currency)}</span>
          <span style={{ color: "var(--neg)" }}>Bear</span>
          <span>{money(r.bear!, currency)}</span>
        </div>
      )}
    </div>
  );
}
