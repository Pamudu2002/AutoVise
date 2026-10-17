import type { Metadata } from "next";
import { CompareView } from "@/components/compare-view";
import { getCompareRows } from "@/lib/data/insights";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Compare companies", description: "Up to three listed companies side by side: targets, upside, confidence, ratios and qualitative factors." };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [{ c }, rows, settings] = await Promise.all([searchParams, getCompareRows(), getSettings()]);
  const ranked = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const requested = (c ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => rows.some((r) => r.slug === s));
  const selected = [...new Set(requested)].slice(0, 3);
  return <CompareView rows={rows} selected={selected.length ? selected : ranked.slice(0, 3).map((r) => r.slug)} disclaimer={settings.disclaimer.short} />;
}
