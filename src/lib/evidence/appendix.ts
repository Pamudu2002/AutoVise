import { matrixWarnings, sampleCounts, type Matrix } from "./matrix";
import { LANGUAGE_LABEL, PLATFORM_LABEL, PRODUCT_LABEL, SECTION_LABEL, type EntityLite, type GroupLite, type Language, type Platform, type RecordLite, type ReportSection } from "./types";

/**
 * Data for the public methodology appendix (PLAN2 §7.6). No usernames, no contributor refs and no
 * links to individual posts are included — only aggregates and paraphrased examples.
 */
export interface AppendixData {
  title: string;
  collectionDate: string;
  windowStart: string;
  windowMonths: number;
  questions: { question: string; section: string }[];
  platforms: { platform: string; decision: string; reason: string | null; searchTerms: string[]; sortMethod: string | null; coverageNote: string | null }[];
  languages: string[];
  languageLimitations: string | null;
  sample: { group: string; entity: string; platform: string; records: number; threads: number; contributors: number }[];
  matrix: Matrix;
  themes: { key: string; label: string }[];
  limitations: string[];
  examples: { entity: string; platform: string; month: string; text: string }[];
  totals: { included: number; excluded: number };
}

export function buildAppendix(input: {
  study: { title: string; collectionDate: string; windowStart: string; windowMonths: number; languages: Language[]; languageLimitations: string | null; limitations: string | null; minNForPercent: number };
  questions: { question: string; reportSection: ReportSection }[];
  screenings: { platform: Platform; decision: string; reason: string | null; searchTerms: string[]; sortMethod: string | null; coverageNote: string | null }[];
  groups: GroupLite[];
  entities: EntityLite[];
  records: (RecordLite & { publicExample: boolean; postedAt: string | null; language: Language })[];
  matrix: Matrix;
  themes?: { key: string; label: string }[];
  autoLimitations: string[];
}): AppendixData {
  const included = input.records.filter((r) => r.included);
  const sample: AppendixData["sample"] = [];
  for (const g of input.groups) {
    for (const e of input.entities.filter((x) => x.groupId === g.id)) {
      for (const p of [...new Set(included.filter((r) => r.entityId === e.id).map((r) => r.platform))].sort()) {
        const s = sampleCounts(included.filter((r) => r.entityId === e.id && r.platform === p));
        sample.push({ group: g.name, entity: e.name, platform: PLATFORM_LABEL[p], records: s.n, threads: s.threads, contributors: s.contributors });
      }
    }
  }
  const notInterpretable = included.filter((r) => !input.study.languages.includes(r.language) && !r.translationEn).length;
  const limitations = [
    "This is an exploratory sample of public, first-hand accounts. Counts describe the records collected, not the views of all customers, and they are not failure rates.",
    `Only accounts posted between ${input.study.windowStart} and ${input.study.collectionDate} were included.`,
    "Platforms are analysed separately; star ratings are not combined, and there is no overall score or ranking of operators.",
    ...input.autoLimitations,
    ...matrixWarnings(input.matrix),
    ...(notInterpretable ? [`${notInterpretable} records in languages the team could not interpret were left uncoded.`] : []),
    ...(input.study.languageLimitations ? [input.study.languageLimitations] : []),
    ...(input.study.limitations ? input.study.limitations.split(/\n+/).filter(Boolean) : []),
  ];
  const byEntity = new Map(input.entities.map((e) => [e.id, e.name]));
  const examples = included
    .filter((r) => r.publicExample && r.codingStatus === "checked")
    .slice(0, 5)
    .map((r) => ({
      entity: byEntity.get(r.entityId) ?? "",
      platform: `${PLATFORM_LABEL[r.platform]} · ${PRODUCT_LABEL[r.product]}`,
      month: r.postedAt ? new Date(r.postedAt + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : "",
      text: r.translationEn ?? r.text,
    }));
  return {
    title: input.study.title,
    collectionDate: input.study.collectionDate,
    windowStart: input.study.windowStart,
    windowMonths: input.study.windowMonths,
    questions: input.questions.map((q) => ({ question: q.question, section: SECTION_LABEL[q.reportSection] })),
    platforms: input.screenings.map((s) => ({ platform: PLATFORM_LABEL[s.platform], decision: s.decision, reason: s.reason, searchTerms: s.searchTerms, sortMethod: s.sortMethod, coverageNote: s.coverageNote })),
    languages: input.study.languages.map((l) => LANGUAGE_LABEL[l]),
    languageLimitations: input.study.languageLimitations,
    sample,
    matrix: input.matrix,
    themes: (input.themes ?? []).map((t) => ({ key: t.key, label: t.label })),
    limitations,
    examples,
    totals: { included: included.length, excluded: input.records.length - included.length },
  };
}
