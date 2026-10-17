"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";

export interface RadarSeries {
  name: string;
  values: number[];
  color: string;
  dash?: string;
}

/** Six qualitative factors on a 0–100 radar; one or more series (overlay on the compare page). */
export function FactorRadar({ labels, series, height = 300, label }: { labels: string[]; series: RadarSeries[]; height?: number; label: string }) {
  const data = labels.map((l, i) => Object.fromEntries([["factor", l], ...series.map((s, k) => [`s${k}`, s.values[i] ?? 0])]));
  return (
    <div role="img" aria-label={label} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="62%" margin={{ top: 12, right: 56, bottom: 12, left: 56 }}>
          <PolarGrid stroke="var(--grid)" />
          <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11.5, fill: "var(--muted)", fontWeight: 500 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
          {series.map((s, k) => (
            <Radar
              key={s.name}
              name={s.name}
              dataKey={`s${k}`}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash}
              fill={series.length > 1 ? s.color : "var(--band)"}
              fillOpacity={series.length > 1 ? 0.08 : 1}
              isAnimationActive={false}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
