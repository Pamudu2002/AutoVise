import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  admins,
  companies,
  evidenceComparisonGroups,
  evidenceDuplicateDismissals,
  evidenceEntities,
  evidenceFindings,
  evidencePlatformScreenings,
  evidenceRecords,
  evidenceRecordThemes,
  evidenceResearchQuestions,
  evidenceStudies,
  evidenceTargets,
  evidenceThemes,
  type EvidenceRecord,
} from "@/lib/db/schema";
import { buildAppendix } from "./appendix";
import { duplicateCandidates, pairKey } from "./duplicates";
import { buildMatrix, matrixWarnings } from "./matrix";
import { targetProgress, targetWarnings } from "./targets";
import type { EntityLite, GroupLite, RecordLite, TargetLite, ThemeLite } from "./types";

export async function listStudies(companyId: string) {
  return db.select().from(evidenceStudies).where(eq(evidenceStudies.companyId, companyId)).orderBy(desc(evidenceStudies.createdAt));
}

export async function getStudyBundle(studyId: string) {
  const study = await db.query.evidenceStudies.findFirst({ where: eq(evidenceStudies.id, studyId) });
  if (!study) return null;
  const [company, questions, groups, entities, themes, screenings, targets] = await Promise.all([
    db.query.companies.findFirst({ where: eq(companies.id, study.companyId) }),
    db.select().from(evidenceResearchQuestions).where(eq(evidenceResearchQuestions.studyId, studyId)).orderBy(asc(evidenceResearchQuestions.sort)),
    db.select().from(evidenceComparisonGroups).where(eq(evidenceComparisonGroups.studyId, studyId)).orderBy(asc(evidenceComparisonGroups.sort)),
    db.select().from(evidenceEntities).where(eq(evidenceEntities.studyId, studyId)).orderBy(asc(evidenceEntities.sort)),
    db.select().from(evidenceThemes).where(eq(evidenceThemes.studyId, studyId)).orderBy(asc(evidenceThemes.sort)),
    db.select().from(evidencePlatformScreenings).where(eq(evidencePlatformScreenings.studyId, studyId)),
    db.select().from(evidenceTargets).where(eq(evidenceTargets.studyId, studyId)).orderBy(asc(evidenceTargets.sort)),
  ]);
  if (!company) return null;
  return { study, company, questions, groups, entities, themes, screenings, targets };
}
export type StudyBundle = NonNullable<Awaited<ReturnType<typeof getStudyBundle>>>;

export const groupsLite = (b: StudyBundle): GroupLite[] => b.groups.map((g) => ({ id: g.id, name: g.name }));
export const entitiesLite = (b: StudyBundle): EntityLite[] =>
  b.entities.map((e) => ({ id: e.id, name: e.name, groupId: e.groupId, isSubject: e.isSubject, requiresGeoCheck: e.requiresGeoCheck }));
export const themesLite = (b: StudyBundle): ThemeLite[] => b.themes.map((t) => ({ id: t.id, key: t.key, label: t.label }));
export const targetsLite = (b: StudyBundle): TargetLite[] =>
  b.targets.map((t) => ({ id: t.id, label: t.label, groupId: t.groupId, product: t.product, platform: t.platform, perEntity: t.perEntity, targetMin: t.targetMin, targetMax: t.targetMax }));

export type RecordWithThemes = EvidenceRecord & { themeKeys: string[]; themeSources: Record<string, "ai" | "human"> };

/** All records of a study with their theme keys (embedding left out unless asked for). */
export async function getRecords(studyId: string, opts: { withEmbedding?: boolean } = {}): Promise<RecordWithThemes[]> {
  const rows = await db.select().from(evidenceRecords).where(eq(evidenceRecords.studyId, studyId)).orderBy(asc(evidenceRecords.recordCode));
  const links = rows.length
    ? await db
        .select({ recordId: evidenceRecordThemes.recordId, key: evidenceThemes.key, source: evidenceRecordThemes.source })
        .from(evidenceRecordThemes)
        .innerJoin(evidenceThemes, eq(evidenceThemes.id, evidenceRecordThemes.themeId))
        .where(inArray(evidenceRecordThemes.recordId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => {
    const mine = links.filter((l) => l.recordId === r.id);
    return {
      ...r,
      embedding: opts.withEmbedding ? r.embedding : null,
      themeKeys: mine.map((l) => l.key),
      themeSources: Object.fromEntries(mine.map((l) => [l.key, l.source])),
    };
  });
}

export const toLite = (r: RecordWithThemes): RecordLite => ({
  id: r.id,
  recordCode: r.recordCode,
  entityId: r.entityId,
  platform: r.platform,
  product: r.product,
  threadId: r.threadId,
  contributorRef: r.contributorRef,
  included: r.included,
  codingStatus: r.codingStatus,
  sentiment: r.sentiment,
  switching: r.switching,
  switchingNote: r.switchingNote,
  themeKeys: r.themeKeys,
  text: r.text,
  translationEn: r.translationEn,
});

export async function getFindings(studyId: string) {
  return db.select().from(evidenceFindings).where(eq(evidenceFindings.studyId, studyId)).orderBy(asc(evidenceFindings.sort), asc(evidenceFindings.createdAt));
}

/** Everything the Overview, Analysis and Appendix need, computed from the current rows. */
export async function studyAnalysis(studyId: string) {
  const bundle = await getStudyBundle(studyId);
  if (!bundle) return null;
  const records = await getRecords(studyId, { withEmbedding: true });
  const lite = records.map(toLite);
  const groups = groupsLite(bundle);
  const entities = entitiesLite(bundle);
  const themes = themesLite(bundle);
  const targets = targetsLite(bundle);
  const matrix = buildMatrix({ records: lite, entities, groups, themes, minNForPercent: bundle.study.minNForPercent });
  const progress = targetProgress(targets, lite, entities);
  const tw = targetWarnings({ targets, progress, records: lite, entities, groups });
  const dismissed = await db.select().from(evidenceDuplicateDismissals).where(eq(evidenceDuplicateDismissals.studyId, studyId));
  const duplicates = duplicateCandidates(
    records.filter((r) => r.included).map((r) => ({ id: r.id, recordCode: r.recordCode, text: r.translationEn ?? r.text, embedding: (r.embedding as number[] | null) ?? null })),
    { dismissed: new Set(dismissed.map((d) => pairKey(d.recordA, d.recordB))) },
  );
  return { bundle, records, lite, groups, entities, themes, targets, matrix, progress, warnings: [...tw.warnings, ...matrixWarnings(matrix)], limitations: tw.limitations, duplicates };
}

export async function appendixFor(studyId: string) {
  const a = await studyAnalysis(studyId);
  if (!a) return null;
  const { bundle } = a;
  return buildAppendix({
    study: bundle.study,
    questions: bundle.questions,
    screenings: bundle.screenings,
    groups: a.groups,
    entities: a.entities,
    records: a.records.map((r) => ({ ...toLite(r), publicExample: r.publicExample, postedAt: r.postedAt, language: r.language })),
    matrix: a.matrix,
    themes: a.themes,
    autoLimitations: a.limitations,
  });
}

export async function adminNames(ids: (string | null)[]): Promise<Record<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return {};
  const rows = await db.select({ id: admins.id, name: admins.name }).from(admins).where(inArray(admins.id, list));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

/** Approved findings for a company, with the study details needed for attribution. */
export async function approvedFindingsForCompany(companyId: string) {
  const studies = await db.select().from(evidenceStudies).where(eq(evidenceStudies.companyId, companyId));
  if (!studies.length) return [];
  const findings = await db
    .select()
    .from(evidenceFindings)
    .where(and(inArray(evidenceFindings.studyId, studies.map((s) => s.id)), eq(evidenceFindings.status, "approved")))
    .orderBy(asc(evidenceFindings.sort), asc(evidenceFindings.approvedAt));
  const counts = new Map<string, number>();
  for (const s of studies) {
    const rows = await db.select({ included: evidenceRecords.included }).from(evidenceRecords).where(eq(evidenceRecords.studyId, s.id));
    counts.set(s.id, rows.filter((r) => r.included).length);
  }
  return findings.map((f) => {
    const s = studies.find((x) => x.id === f.studyId)!;
    return { finding: f, study: s, n: counts.get(s.id) ?? 0 };
  });
}

/** Study whose appendix is public for a company (the most recent published one). */
export async function publishedStudyForCompany(companyId: string) {
  return db.query.evidenceStudies.findFirst({
    where: and(eq(evidenceStudies.companyId, companyId), eq(evidenceStudies.appendixPublished, true)),
    orderBy: [desc(evidenceStudies.collectionDate), desc(evidenceStudies.createdAt)],
  });
}

/** Paraphrased example accounts chosen for the published appendix (checked records only, max 5). */
export async function publicExamplesForCompany(companyId: string) {
  const study = await publishedStudyForCompany(companyId);
  if (!study) return [];
  const rows = await db
    .select({ text: evidenceRecords.text, translationEn: evidenceRecords.translationEn, platform: evidenceRecords.platform, entity: evidenceEntities.name })
    .from(evidenceRecords)
    .innerJoin(evidenceEntities, eq(evidenceEntities.id, evidenceRecords.entityId))
    .where(and(eq(evidenceRecords.studyId, study.id), eq(evidenceRecords.publicExample, true), eq(evidenceRecords.included, true), eq(evidenceRecords.codingStatus, "checked")))
    .orderBy(asc(evidenceRecords.recordCode))
    .limit(5);
  return rows.map((r) => ({ entity: r.entity, platform: r.platform, text: r.translationEn ?? r.text }));
}
