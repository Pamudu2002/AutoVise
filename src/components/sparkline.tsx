"use client";

import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";

/** Price history (left two-thirds) plus a dotted 3-year base projection (right third). */
export function Sparkline({ history, projection, label, height = 56 }: { history: number[]; projection: number[]; label: string; height?: number }) {
  const n = history.length;
  const hist = history.map((v, i) => ({ x: n > 1 ? (i * 200) / (n - 1) : 200, v }));
  const last = history[n - 1];
  const proj = projection.length && last !== undefined ? [{ x: 200, v: last }, ...projection.map((v, i) => ({ x: 200 + (i + 1) * (100 / projection.length), v }))] : [];
  const up = projection.length ? projection[projection.length - 1] >= last : true;
  const all = [...history, ...projection];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  return (
    <div role="img" aria-label={label} style={{ width: "100%", height }}>
      {n > 1 && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
            <XAxis type="number" dataKey="x" domain={[0, 300]} hide />
            <YAxis type="number" domain={[lo - pad, hi + pad]} hide />
            <ReferenceLine x={200} stroke="var(--border)" strokeDasharray="2 3" />
            <Line data={hist} dataKey="v" type="linear" stroke="var(--c1)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
            {proj.length > 0 && (
              <Line data={proj} dataKey="v" type="linear" stroke={up ? "var(--pos)" : "var(--neg)"} strokeWidth={1.75} strokeDasharray="3 4" strokeLinecap="round" dot={false} isAnimationActive={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
