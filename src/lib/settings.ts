import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { settings as settingsTable } from "@/lib/db/schema";
import { DEFAULT_VALUATION_SETTINGS } from "@/lib/valuation/defaults";
import { FACTOR_KEYS } from "@/lib/valuation/types";

const frac = (min: number, max: number) => z.number().min(min).max(max);

export const valuationSettingsSchema = z.object({
  horizonYears: z.literal(3),
  growthWeights: z.object({ historical: frac(0, 1), sustainable: frac(0, 1), sector: frac(0, 1) }),
  meanReversion: frac(0, 1),
  peConvergence: frac(0, 1),
  minGrowth: frac(-0.5, 0),
  maxGrowth: frac(0, 1),
  minExitPe: z.number().min(1).max(20),
  maxExitPe: z.number().min(5).max(80),
  qualGrowthCap: frac(0, 0.1),
  qualMultipleCap: frac(0, 0.5),
  tiltCap: frac(0, 0.3),
  scenario: z.object({ growthShift: frac(0, 0.2), peShift: frac(0, 0.5) }),
  ddm: z.object({ weight: frac(0, 1), costOfEquity: frac(0.02, 0.4), terminalGrowthCap: frac(0, 0.15) }),
  factorWeights: z.object(Object.fromEntries(FACTOR_KEYS.map((k) => [k, z.number().min(0).max(5)])) as Record<(typeof FACTOR_KEYS)[number], z.ZodNumber>),
  scoreWeights: z
    .object({ upside: z.number().int().min(0).max(100), quality: z.number().int().min(0).max(100), confidence: z.number().int().min(0).max(100) })
    .refine((w) => w.upside + w.quality + w.confidence === 100, { message: "Score weights must add up to 100." }),
});

export const appSettingsSchema = z.object({
  valuation: valuationSettingsSchema,
  publishing: z.object({
    autoPublish: z.boolean(),
    /** Auto-publish only when the base target moves less than this (fraction). */
    maxChange: frac(0, 1),
    /** Auto-publish only at or above this confidence. */
    autoMinConfidence: z.number().int().min(0).max(100),
    /** Below this, a prediction cannot be published and the company shows as pending. */
    minConfidenceToPublish: z.number().int().min(0).max(100),
    /** Prices older than this many trading days are flagged as stale. */
    stalePriceDays: z.number().int().min(1).max(60),
  }),
  extraction: z.object({
    /** Skip the review step and approve extracted data automatically. */
    autoApprove: z.boolean(),
  }),
  chat: z.object({
    perIpPerHour: z.number().int().min(1).max(1000),
    perSessionPerHour: z.number().int().min(1).max(1000),
  }),
  disclaimer: z.object({
    short: z.string().min(10).max(90),
    long: z.string().min(20).max(1200),
  }),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  valuation: DEFAULT_VALUATION_SETTINGS as AppSettings["valuation"],
  publishing: { autoPublish: false, maxChange: 0.05, autoMinConfidence: 70, minConfidenceToPublish: 50, stalePriceDays: 2 },
  extraction: { autoApprove: false },
  chat: { perIpPerHour: 30, perSessionPerHour: 20 },
  disclaimer: {
    short: "Predictions are model estimates, not financial advice.",
    long: "AutoVise publishes model-generated estimates for research and education. Predictions are model estimates, not financial advice, and are not a recommendation to buy or sell any security. Share prices may be delayed. Past predictions do not guarantee future accuracy. Speak to a licensed adviser before investing.",
  },
};

/** Deep-merge stored settings over the defaults, so new keys get defaults after an upgrade. */
function merge<T>(base: T, over: unknown): T {
  if (typeof base !== "object" || base === null || Array.isArray(base)) return (over ?? base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  if (over && typeof over === "object") {
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      out[k] = k in out ? merge(out[k], v) : v;
    }
  }
  return out as T;
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const row = await db.query.settings.findFirst({ where: eq(settingsTable.id, 1) });
    if (!row) return DEFAULT_SETTINGS;
    const parsed = appSettingsSchema.safeParse(merge(DEFAULT_SETTINGS, row.data));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
