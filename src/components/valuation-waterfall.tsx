"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { WaterfallStep } from "@/lib/valuation/types";
import { money, num } from "@/lib/format";

const COLOR: Record<WaterfallStep["key"], string> = {
  current: "var(--c1)",
  earnings: "var(--pos)",
  multiple: "var(--pos)",
  dcf: "var(--pos)",
  dividend: "var(--pos)",
  qualitative: "var(--pos)",
  target: "var(--c2)",
};

/** Current price → earnings growth → multiple change → qualitative adjustment → target (stacked bars with an invisible base). */
export function ValuationWaterfall({ steps, currency }: { steps: WaterfallStep[]; currency: string }) {
  const data = steps.map((s) => {
    const total = s.key === "current" || s.key === "target";
    const lo = Math.min(s.start, s.end);
    const hi = Math.max(s.start, s.end);
    const up = s.end >= s.start;
    return {
      label: s.label,
      range: [total ? 0 : lo, hi] as [number, number],
      fill: total ? COLOR[s.key] : up ? "var(--pos)" : "var(--neg)",
      text: total ? num(s.value) : `${up ? "+" : "−"}${num(Math.abs(s.value))}`,
      textColor: total ? "var(--text)" : up ? "var(--pos)" : "var(--neg)",
    };
  });
  const top = Math.max(...steps.map((s) => Math.max(s.start, s.end)));
  const describe = steps
    .map((s) => (s.key === "current" ? `${s.label} ${money(s.value, currency)}` : s.key === "target" ? `equals target ${money(s.value, currency)}` : `${s.value >= 0 ? "plus" : "minus"} ${s.label.toLowerCase()} ${money(Math.abs(s.value), currency)}`))
    .join(", ");

  return (
    <div role="img" aria-label={describe + "."} style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 8, left: 8 }} barCategoryGap="28%">
          <XAxis
            dataKey="label"
            interval={0}
            tickLine={false}
            axisLine={{ stroke: "var(--border-strong)" }}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            height={36}
          />
          <YAxis hide domain={[0, top * 1.12]} />
          <Bar dataKey="range" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
            <LabelList
              dataKey="text"
              position="top"
              content={(p) => {
                const d = data[Number(p.index)];
                return (
                  <text x={Number(p.x) + Number(p.width) / 2} y={Number(p.y) - 6} textAnchor="middle" fontSize={13} fontWeight={600} fill={d.textColor} fontFamily="var(--mono)">
                    {d.text}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
