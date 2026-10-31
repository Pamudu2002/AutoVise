import { z } from "zod";
import { EXCLUSIONS, LANGUAGES, PLATFORMS, PRODUCTS, REPORT_SECTIONS, SENTIMENTS } from "./types";

/** Removes usernames/handles, emails and phone numbers (PLAN2 rule 5). Returns what was removed. */
export function stripPii(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const take = (re: RegExp, label: string) => (s: string) =>
    s.replace(re, (_m, lead?: string) => {
      removed.push(label);
      return `${typeof lead === "string" ? lead : ""}[removed]`;
    });
  let out = text;
  out = take(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "email")(out);
  out = take(/(^|[\s(])@[A-Za-z0-9_.]{2,30}\b/g, "handle")(out);
  out = take(/\bu\/[A-Za-z0-9_-]{3,}\b/g, "handle")(out);
  out = take(/(?:\+94[\s-]?|\b0)7\d[\s-]?\d{3}[\s-]?\d{4}\b/g, "phone")(out);
  out = take(/(?<![\w.])\+?\d(?:[\s-]?\d){8,13}(?![\w.])/g, "phone")(out);
  return { text: out.trim(), removed };
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** A record as edited by a person or produced by the import (before entity checks). */
export const recordInputSchema = z
  .object({
    recordCode: z.string().regex(/^R\d{3,}$/, "Record IDs look like R001.").optional(),
    platform: z.enum(PLATFORMS),
    sourceUrl: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => !v || /^https?:\/\//i.test(v), "The source URL must start with http:// or https://"),
    postedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    collectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    threadId: optText(120),
    contributorRef: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => !v || /^[A-Za-z0-9._-]+$/.test(v), "Contributor refs are team codes like T03-C2, never usernames."),
    starRating: z.number().int().min(1).max(5).nullable().optional(),
    entityId: z.string().min(1, "Choose the operator."),
    product: z.enum(PRODUCTS),
    productEvidence: optText(500),
    geoConfirmed: z.boolean(),
    text: z.string().trim().min(3, "The record needs its relevant text or a paraphrase.").max(4000),
    language: z.enum(LANGUAGES),
    translationEn: optText(4000),
    sentiment: z.enum(SENTIMENTS).nullable(),
    switching: z.boolean(),
    switchingNote: optText(500),
    themeKeys: z.array(z.string()).max(10),
    included: z.boolean(),
    exclusionReason: z.enum(EXCLUSIONS).nullable(),
    inclusionNote: optText(500),
  })
  .superRefine((r, ctx) => {
    if (r.product === "air_fibre" && !r.productEvidence) {
      ctx.addIssue({ code: "custom", path: ["productEvidence"], message: "Air Fibre needs the words from the source that name the product." });
    }
    if (!r.included && !r.exclusionReason) {
      ctx.addIssue({ code: "custom", path: ["exclusionReason"], message: "Choose why the record is excluded." });
    }
  });
export type RecordInput = z.output<typeof recordInputSchema>;

export const studySetupSchema = z.object({
  title: z.string().trim().min(3).max(140),
  collectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowMonths: z.coerce.number().int().min(1).max(36),
  languages: z.array(z.enum(LANGUAGES)).min(1),
  languageLimitations: optText(1000),
  minNForPercent: z.coerce.number().int().min(5).max(500),
  qaRate: z.coerce.number().min(0.05).max(1),
  notes: optText(2000),
  limitations: optText(2000),
  questions: z
    .array(z.object({ id: z.string().uuid().optional(), question: z.string().trim().min(10).max(400), reportSection: z.enum(REPORT_SECTIONS) }))
    .min(1)
    .max(6),
  themes: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        key: z
          .string()
          .trim()
          .regex(/^[a-z][a-z0-9_]{1,39}$/, "Theme keys use lowercase letters, digits and underscores."),
        label: z.string().trim().min(2).max(80),
        description: optText(400),
        investmentRelevance: optText(300),
      }),
    )
    .min(1)
    .max(15),
});
export type StudySetup = z.output<typeof studySetupSchema>;
