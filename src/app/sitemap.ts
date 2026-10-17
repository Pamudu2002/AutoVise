import type { MetadataRoute } from "next";
import { listPublishedSlugs } from "@/lib/data/public";
import { env } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");
  const slugs = await listPublishedSlugs().catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/compare`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/track-record`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/methodology`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/disclaimer`, changeFrequency: "yearly", priority: 0.3 },
    ...slugs.map((s) => ({ url: `${base}/companies/${s}`, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
