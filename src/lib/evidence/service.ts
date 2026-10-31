import "server-only";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { UserError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
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
} from "@/lib/db/schema";
import { embedDocuments } from "@/lib/pipeline/embed";
import { codeRecordAI, draftFindingsAI } from "./ai";
import { getFindings, getRecords, getStudyBundle, studyAnalysis, toLite, entitiesLite, groupsLite, themesLite } from "./data";
import { allowedNumbers } from "./matrix";
import { guardFinding, type GuardWarning } from "./guard";
import { validateRows, type ColumnMapping, type ImportResult } from "./import";
import { selectQaSample } from "./qa-sample";
import { searchTermsFor, TEMPLATES } from "./templates/telecom-sl";
import type { Exclusion, Platform, Product, QaField, ReportSection, Sentiment, StudyStatus, Support } from "./types";
import { recordInputSchema, type RecordInput, type StudySetup } from "./validation";
import { windowStart } from "./window";

export class EvidenceError extends UserError {}

// ─── Studies ──────────────────────────────────────────────────────────────
export async function createStudy(input: { companyId: string; title: string; collectionDate: string; templateKey: string | null }, adminId: string) {
  const t = input.templateKey ? TEMPLATES[input.templateKey] : null;
  if (input.templateKey && !t) throw new EvidenceError("Unknown template.");
  const months = t?.windowMonths ?? 6;
  return db.transaction(async (tx) => {
    const [study] = await tx
      .insert(evidenceStudies)
      .values({
        companyId: input.companyId,
        title: input.title,
        collectionDate: input.collectionDate,
        windowMonths: months,
        windowStart: windowStart(input.collectionDate, months),
        templateKey: t?.key ?? null,
        createdBy: adminId,
        notes: t?.teamSplit ?? null,
      })
      .returning();
    if (!t) return study;
    await tx.insert(evidenceResearchQuestions).values(t.questions.map((q, i) => ({ studyId: study.id, question: q.question, reportSection: q.reportSection, sort: i })));
    const groupIds = new Map<string, string>();
    for (const [gi, g] of t.groups.entries()) {
      const [row] = await tx.insert(evidenceComparisonGroups).values({ studyId: study.id, name: g.name, sort: gi }).returning();
      groupIds.set(g.name, row.id);
      await tx.insert(evidenceEntities).values(
        g.entities.map((e, ei) => ({
          studyId: study.id,
          groupId: row.id,
          name: e.name,
          isSubject: !!e.isSubject,
          companyId: e.isSubject ? input.companyId : null,
          requiresGeoCheck: !!e.requiresGeoCheck,
          sort: gi * 10 + ei,
        })),
      );
    }
    await tx.insert(evidenceThemes).values(t.themes.map((th, i) => ({ studyId: study.id, key: th.key, label: th.label, description: th.description, investmentRelevance: th.investmentRelevance, sort: i })));
    const terms = searchTermsFor(t);
    await tx.insert(evidencePlatformScreenings).values(
      t.platforms.map((p) => ({
        studyId: study.id,
        platform: p.platform,
        decision: p.decision,
        reason: p.reason,
        sortMethod: p.sortMethod,
        coverageNote: p.coverageNote,
        searchTerms: p.decision === "excluded" ? [] : terms,
      })),
    );
    await tx.insert(evidenceTargets).values(
      t.targets.map((x, i) => ({
        studyId: study.id,
        label: x.label,
        groupId: x.group ? groupIds.get(x.group)! : null,
        product: x.product,
        platform: x.platform,
        perEntity: x.perEntity,
        targetMin: x.min,
        targetMax: x.max,
        sort: i,
      })),
    );
    return study;
  });
}

export async function saveSetup(studyId: string, s: StudySetup) {
  const bundle = await getStudyBundle(studyId);
  if (!bundle) throw new EvidenceError("Study not found.");
  const keys = s.themes.map((t) => t.key);
  if (new Set(keys).size !== keys.length) throw new EvidenceError("Theme keys must be unique.");
  await db.transaction(async (tx) => {
    await tx
      .update(evidenceStudies)
      .set({
        title: s.title,
        collectionDate: s.collectionDate,
        windowMonths: s.windowMonths,
        windowStart: windowStart(s.collectionDate, s.windowMonths),
        languages: s.languages,
        languageLimitations: s.languageLimitations,
        minNForPercent: s.minNForPercent,
        qaRate: s.qaRate,
        notes: s.notes,
        limitations: s.limitations,
        updatedAt: new Date(),
      })
      .where(eq(evidenceStudies.id, studyId));
    const keepQ = s.questions.map((q) => q.id).filter(Boolean) as string[];
    for (const q of bundle.questions) if (!keepQ.includes(q.id)) await tx.delete(evidenceResearchQuestions).where(eq(evidenceResearchQuestions.id, q.id));
    for (const [i, q] of s.questions.entries()) {
      if (q.id) await tx.update(evidenceResearchQuestions).set({ question: q.question, reportSection: q.reportSection, sort: i }).where(eq(evidenceResearchQuestions.id, q.id));
      else await tx.insert(evidenceResearchQuestions).values({ studyId, question: q.question, reportSection: q.reportSection, sort: i });
    }
    const keepT = s.themes.map((t) => t.id).filter(Boolean) as string[];
    for (const t of bundle.themes) if (!keepT.includes(t.id)) await tx.delete(evidenceThemes).where(eq(evidenceThemes.id, t.id));
    for (const [i, t] of s.themes.entries()) {
      const values = { key: t.key, label: t.label, description: t.description, investmentRelevance: t.investmentRelevance, sort: i };
      if (t.id) await tx.update(evidenceThemes).set(values).where(eq(evidenceThemes.id, t.id));
      else await tx.insert(evidenceThemes).values({ studyId, ...values });
    }
  });
  // A new window can move records in or out of it.
  await applyWindow(studyId);
}

/** Re-applies the window: out-of-window records are excluded; ones excluded only for the window come back. */
export async function applyWindow(studyId: string) {
  const study = await db.query.evidenceStudies.findFirst({ where: eq(evidenceStudies.id, studyId) });
  if (!study) return;
  const rows = await db.select().from(evidenceRecords).where(eq(evidenceRecords.studyId, studyId));
  for (const r of rows) {
    const inside = !!r.postedAt && r.postedAt >= study.windowStart && r.postedAt <= study.collectionDate;
    if (!inside && r.included) await db.update(evidenceRecords).set({ included: false, exclusionReason: "out_of_window" }).where(eq(evidenceRecords.id, r.id));
    if (inside && !r.included && r.exclusionReason === "out_of_window") await db.update(evidenceRecords).set({ included: true, exclusionReason: null }).where(eq(evidenceRecords.id, r.id));
  }
}

export async function saveEntity(studyId: string, e: { id?: string; groupId: string; name: string; isSubject: boolean; requiresGeoCheck: boolean }) {
  const values = { groupId: e.groupId, name: e.name.trim(), isSubject: e.isSubject, requiresGeoCheck: e.requiresGeoCheck };
  if (!values.name) throw new EvidenceError("Give the entity a name.");
  if (e.id) await db.update(evidenceEntities).set(values).where(and(eq(evidenceEntities.id, e.id), eq(evidenceEntities.studyId, studyId)));
  else await db.insert(evidenceEntities).values({ studyId, ...values, sort: 99 });
}

export async function deleteEntity(studyId: string, entityId: string) {
  const used = await db.select({ id: evidenceRecords.id }).from(evidenceRecords).where(eq(evidenceRecords.entityId, entityId)).limit(1);
  if (used.length) throw new EvidenceError("This entity has records; move or delete them first.");
  await db.delete(evidenceEntities).where(and(eq(evidenceEntities.id, entityId), eq(evidenceEntities.studyId, studyId)));
}

export async function saveGroup(studyId: string, g: { id?: string; name: string }) {
  if (!g.name.trim()) throw new EvidenceError("Give the group a name.");
  if (g.id) await db.update(evidenceComparisonGroups).set({ name: g.name.trim() }).where(and(eq(evidenceComparisonGroups.id, g.id), eq(evidenceComparisonGroups.studyId, studyId)));
  else await db.insert(evidenceComparisonGroups).values({ studyId, name: g.name.trim(), sort: 99 });
}

export async function saveTarget(studyId: string, t: { id?: string; label: string; groupId: string | null; product: Product | null; platform: Platform | null; perEntity: boolean; targetMin: number; targetMax: number }) {
  if (t.targetMin < 0 || t.targetMax < t.targetMin) throw new EvidenceError("The target range is not valid.");
  const values = { label: t.label, groupId: t.groupId, product: t.product, platform: t.platform, perEntity: t.perEntity, targetMin: t.targetMin, targetMax: t.targetMax };
  if (t.id) await db.update(evidenceTargets).set(values).where(and(eq(evidenceTargets.id, t.id), eq(evidenceTargets.studyId, studyId)));
  else await db.insert(evidenceTargets).values({ studyId, ...values, sort: 99 });
}

export async function setStatus(studyId: string, status: StudyStatus) {
  await db.update(evidenceStudies).set({ status, updatedAt: new Date() }).where(eq(evidenceStudies.id, studyId));
}

export async function saveScreening(
  studyId: string,
  platform: Platform,
  s: { decision: "pending" | "selected" | "excluded"; reason: string | null; searchTerms: string[]; sortMethod: string | null; coverageNote: string | null },
  adminId: string,
) {
  if (s.decision !== "pending" && !s.reason?.trim()) throw new EvidenceError("Give a reason for selecting or excluding a platform.");
  const values = { decision: s.decision, reason: s.reason?.trim() || null, searchTerms: s.searchTerms.map((x) => x.trim()).filter(Boolean), sortMethod: s.sortMethod, coverageNote: s.coverageNote, screenedBy: adminId, screenedAt: new Date() };
  await db
    .insert(evidencePlatformScreenings)
    .values({ studyId, platform, ...values })
    .onConflictDoUpdate({ target: [evidencePlatformScreenings.studyId, evidencePlatformScreenings.platform], set: values });
}

// ─── Records ──────────────────────────────────────────────────────────────
async function setThemes(recordId: string, studyId: string, keys: string[], source: "ai" | "human" | ((key: string) => "ai" | "human")) {
  const themes = await db.select().from(evidenceThemes).where(eq(evidenceThemes.studyId, studyId));
  const ids = keys.map((k) => themes.find((t) => t.key === k)).filter((t): t is (typeof themes)[number] => !!t);
  if (ids.length !== keys.length) throw new EvidenceError("Unknown theme key.");
  await db.delete(evidenceRecordThemes).where(eq(evidenceRecordThemes.recordId, recordId));
  if (ids.length) await db.insert(evidenceRecordThemes).values(ids.map((t) => ({ recordId, themeId: t.id, source: typeof source === "function" ? source(t.key) : source })));
}

/** Entity rules that need the database: geo-checked entities need a confirmed Sri Lankan experience. */
async function checkEntityRules(studyId: string, r: RecordInput) {
  const entity = await db.query.evidenceEntities.findFirst({ where: and(eq(evidenceEntities.id, r.entityId), eq(evidenceEntities.studyId, studyId)) });
  if (!entity) throw new EvidenceError("Choose an operator from this study.");
  if (entity.requiresGeoCheck && !r.geoConfirmed && r.included) {
    throw new EvidenceError(`${entity.name} records must be confirmed as Sri Lankan experiences; mark it as overseas and exclude it otherwise.`);
  }
}

export async function importRecords(studyId: string, file: { rows: Record<string, unknown>[]; mapping: ColumnMapping }, adminId: string, commit: boolean): Promise<ImportResult & { inserted: number; updated: number }> {
  const bundle = await getStudyBundle(studyId);
  if (!bundle) throw new EvidenceError("Study not found.");
  const existing = await db.select({ id: evidenceRecords.id, recordCode: evidenceRecords.recordCode, codingStatus: evidenceRecords.codingStatus }).from(evidenceRecords).where(eq(evidenceRecords.studyId, studyId));
  const result = validateRows(file.rows, file.mapping, {
    entities: entitiesLite(bundle),
    groups: groupsLite(bundle),
    themes: themesLite(bundle),
    windowStart: bundle.study.windowStart,
    collectionDate: bundle.study.collectionDate,
    existingCodes: existing.map((e) => e.recordCode),
  });
  if (!commit) return { ...result, inserted: 0, updated: 0 };
  let inserted = 0;
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const r of result.valid) {
      const prev = existing.find((e) => e.recordCode === r.recordCode);
      const coding = r.coded
        ? { sentiment: r.sentiment, switching: r.switching, switchingNote: r.switchingNote, codingStatus: "coded" as const, codedBy: adminId, codedAt: new Date() }
        : { sentiment: r.sentiment, switching: r.switching, switchingNote: r.switchingNote };
      const values = {
        platform: r.platform,
        sourceUrl: r.sourceUrl,
        postedAt: r.postedAt,
        collectionDate: r.collectionDate,
        threadId: r.threadId,
        contributorRef: r.contributorRef,
        starRating: r.starRating ?? null,
        entityId: r.entityId,
        product: r.product,
        productEvidence: r.productEvidence,
        geoConfirmed: r.geoConfirmed,
        text: r.text,
        language: r.language,
        translationEn: r.translationEn,
        included: r.included,
        exclusionReason: r.exclusionReason,
        inclusionNote: r.inclusionNote,
        embedding: null,
        updatedAt: new Date(),
        ...coding,
      };
      let id: string;
      if (prev) {
        await tx.update(evidenceRecords).set(values).where(eq(evidenceRecords.id, prev.id));
        id = prev.id;
        updated++;
      } else {
        const [row] = await tx.insert(evidenceRecords).values({ studyId, recordCode: r.recordCode!, ...values }).returning({ id: evidenceRecords.id });
        id = row.id;
        inserted++;
      }
      if (r.coded) {
        const ids = bundle.themes.filter((t) => r.themeKeys.includes(t.key));
        await tx.delete(evidenceRecordThemes).where(eq(evidenceRecordThemes.recordId, id));
        if (ids.length) await tx.insert(evidenceRecordThemes).values(ids.map((t) => ({ recordId: id, themeId: t.id, source: "human" as const })));
      }
    }
  });
  return { ...result, inserted, updated };
}

export async function nextRecordCode(studyId: string): Promise<string> {
  const rows = await db.select({ code: evidenceRecords.recordCode }).from(evidenceRecords).where(eq(evidenceRecords.studyId, studyId));
  const n = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(1)) || 0), 0);
  return `R${String(n + 1).padStart(3, "0")}`;
}

/** Create or edit a record by hand. Editing coding fields counts as human coding. */
export async function saveRecord(studyId: string, recordId: string | null, raw: unknown, adminId: string) {
  const r = recordInputSchema.parse(raw);
  await checkEntityRules(studyId, r);
  const before = recordId ? await db.query.evidenceRecords.findFirst({ where: and(eq(evidenceRecords.id, recordId), eq(evidenceRecords.studyId, studyId)) }) : null;
  if (recordId && !before) throw new EvidenceError("Record not found.");
  const coded = r.themeKeys.length > 0 || r.sentiment !== null;
  const keepStatus = before && ["checked", "disputed"].includes(before.codingStatus);
  const values = {
    platform: r.platform,
    sourceUrl: r.sourceUrl,
    postedAt: r.postedAt,
    collectionDate: r.collectionDate,
    threadId: r.threadId,
    contributorRef: r.contributorRef,
    starRating: r.starRating ?? null,
    entityId: r.entityId,
    product: r.product,
    productEvidence: r.productEvidence,
    geoConfirmed: r.geoConfirmed,
    text: r.text,
    language: r.language,
    translationEn: r.translationEn,
    sentiment: r.sentiment,
    switching: r.switching,
    switchingNote: r.switchingNote,
    included: r.included,
    exclusionReason: r.included ? null : r.exclusionReason,
    inclusionNote: r.inclusionNote,
    updatedAt: new Date(),
    ...(keepStatus ? {} : coded ? { codingStatus: "coded" as const, codedBy: adminId, codedAt: new Date() } : {}),
    ...(before && before.text !== r.text ? { embedding: null } : {}),
  };
  let id = recordId;
  if (before) await db.update(evidenceRecords).set(values).where(eq(evidenceRecords.id, before.id));
  else {
    const [row] = await db.insert(evidenceRecords).values({ studyId, recordCode: r.recordCode ?? (await nextRecordCode(studyId)), ...values }).returning({ id: evidenceRecords.id });
    id = row.id;
  }
  await setThemes(id!, studyId, r.themeKeys, "human");
  // Out-of-window dates are excluded automatically.
  await applyWindow(studyId);
  return { id: id!, before };
}

export async function setPublicExample(recordId: string, value: boolean) {
  await db.update(evidenceRecords).set({ publicExample: value }).where(eq(evidenceRecords.id, recordId));
}

// ─── AI coding ────────────────────────────────────────────────────────────
/** Codes records with Gemini (or the offline rules). Results are suggestions until a person accepts them. */
export async function codeRecords(studyId: string, recordIds: string[]): Promise<{ suggested: number; skipped: number; failed: number }> {
  const bundle = await getStudyBundle(studyId);
  if (!bundle) return { suggested: 0, skipped: 0, failed: 0 };
  const rows = await db.select().from(evidenceRecords).where(and(eq(evidenceRecords.studyId, studyId), inArray(evidenceRecords.id, recordIds)));
  let suggested = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of rows) {
    // Only uncoded or previously suggested records; languages the team cannot interpret stay uncoded.
    if (!["uncoded", "ai_suggested"].includes(r.codingStatus) || (!bundle.study.languages.includes(r.language) && !r.translationEn)) {
      skipped++;
      continue;
    }
    try {
      const entity = bundle.entities.find((e) => e.id === r.entityId);
      const { coding, model } = await codeRecordAI({
        text: r.text,
        translation: r.translationEn,
        entity: entity?.name ?? "",
        product: r.product,
        themes: bundle.themes.map((t) => ({ key: t.key, label: t.label, description: t.description })),
      });
      await db.update(evidenceRecords).set({ aiSuggestion: { ...coding, model, at: new Date().toISOString() }, codingStatus: "ai_suggested", updatedAt: new Date() }).where(eq(evidenceRecords.id, r.id));
      suggested++;
    } catch (err) {
      console.warn("[evidence] coding failed for", r.recordCode, (err as Error).message);
      failed++;
    }
  }
  return { suggested, skipped, failed };
}

export interface AcceptCoding {
  themeKeys: string[];
  sentiment: Sentiment;
  switching: boolean;
  switchingNote: string | null;
  product: Product;
  productEvidence: string | null;
  translationEn: string | null;
  included: boolean;
  exclusionReason: Exclusion | null;
}

/** A person accepts (possibly edited) coding: the record becomes `coded` with them as coder. */
export async function acceptCoding(recordId: string, c: AcceptCoding, adminId: string) {
  const r = await db.query.evidenceRecords.findFirst({ where: eq(evidenceRecords.id, recordId) });
  if (!r) throw new EvidenceError("Record not found.");
  if (c.product === "air_fibre" && !c.productEvidence?.trim()) throw new EvidenceError("Air Fibre needs the words from the source that name the product.");
  if (!c.included && !c.exclusionReason) throw new EvidenceError("Choose why the record is excluded.");
  const entity = await db.query.evidenceEntities.findFirst({ where: eq(evidenceEntities.id, r.entityId) });
  if (entity?.requiresGeoCheck && c.included && !r.geoConfirmed) throw new EvidenceError(`${entity.name} records need a confirmed Sri Lankan experience before they can be included.`);
  const suggested = new Set((r.aiSuggestion?.themes ?? []) as string[]);
  await db
    .update(evidenceRecords)
    .set({
      sentiment: c.sentiment,
      switching: c.switching,
      switchingNote: c.switchingNote,
      product: c.product,
      productEvidence: c.productEvidence,
      translationEn: c.translationEn ?? r.translationEn,
      included: c.included,
      exclusionReason: c.included ? null : c.exclusionReason,
      codingStatus: "coded",
      codedBy: adminId,
      codedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(evidenceRecords.id, recordId));
  await setThemes(recordId, r.studyId, c.themeKeys, (k) => (suggested.has(k) ? "ai" : "human"));
}

export async function rejectSuggestion(recordId: string) {
  await db.update(evidenceRecords).set({ aiSuggestion: null, codingStatus: "uncoded" }).where(and(eq(evidenceRecords.id, recordId), eq(evidenceRecords.codingStatus, "ai_suggested")));
}

// ─── Embeddings and duplicates ───────────────────────────────────────────
export async function embedStudy(studyId: string): Promise<{ embedded: number }> {
  const rows = await db.select({ id: evidenceRecords.id, text: evidenceRecords.text, translationEn: evidenceRecords.translationEn }).from(evidenceRecords).where(and(eq(evidenceRecords.studyId, studyId), isNull(evidenceRecords.embedding)));
  if (!rows.length) return { embedded: 0 };
  const vectors = await embedDocuments(rows.map((r) => r.translationEn ?? r.text));
  let embedded = 0;
  for (const [i, r] of rows.entries()) {
    if (!vectors[i]) continue;
    await db.update(evidenceRecords).set({ embedding: vectors[i] }).where(eq(evidenceRecords.id, r.id));
    embedded++;
  }
  return { embedded };
}

export async function markDuplicate(recordId: string, duplicateOfId: string) {
  if (recordId === duplicateOfId) throw new EvidenceError("A record cannot duplicate itself.");
  await db.update(evidenceRecords).set({ included: false, exclusionReason: "duplicate", duplicateOfId, updatedAt: new Date() }).where(eq(evidenceRecords.id, recordId));
}

export async function dismissDuplicate(studyId: string, a: string, b: string, adminId: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  await db.insert(evidenceDuplicateDismissals).values({ studyId, recordA: x, recordB: y, dismissedBy: adminId }).onConflictDoNothing();
}

// ─── QA ───────────────────────────────────────────────────────────────────
async function citedIds(studyId: string): Promise<string[]> {
  const findings = await db.select({ ids: evidenceFindings.citedRecordIds }).from(evidenceFindings).where(and(eq(evidenceFindings.studyId, studyId), ne(evidenceFindings.status, "rejected")));
  return [...new Set(findings.flatMap((f) => f.ids))];
}

/** Selects the QA sample (seeded by the study id). Already-checked and cited records always stay in. */
export async function refreshQaSample(studyId: string): Promise<{ size: number }> {
  const study = await db.query.evidenceStudies.findFirst({ where: eq(evidenceStudies.id, studyId) });
  if (!study) throw new EvidenceError("Study not found.");
  const rows = await db.select().from(evidenceRecords).where(eq(evidenceRecords.studyId, studyId));
  const sample = selectQaSample(
    rows.map((r) => ({ id: r.id, recordCode: r.recordCode, entityId: r.entityId, included: r.included, codingStatus: r.codingStatus })),
    { rate: study.qaRate, seed: study.id, cited: await citedIds(studyId), keep: rows.filter((r) => r.checkedBy).map((r) => r.id) },
  );
  for (const r of rows) {
    const want = sample.has(r.id);
    if (want !== r.inQaSample) await db.update(evidenceRecords).set({ inQaSample: want }).where(eq(evidenceRecords.id, r.id));
  }
  return { size: sample.size };
}

/** Second-person check. The checker must not be the coder; any disagreement makes the record disputed. */
export async function submitCheck(recordId: string, fields: Record<QaField, "agree" | "disagree">, note: string | null, adminId: string) {
  const r = await db.query.evidenceRecords.findFirst({ where: eq(evidenceRecords.id, recordId) });
  if (!r) throw new EvidenceError("Record not found.");
  if (!r.inQaSample) throw new EvidenceError("This record is not in the QA sample.");
  if (!["coded", "checked", "disputed"].includes(r.codingStatus)) throw new EvidenceError("Only coded records can be checked.");
  if (r.codedBy === adminId) throw new EvidenceError("You coded this record, so someone else has to check it.");
  const agreeAll = Object.values(fields).every((v) => v === "agree");
  if (!agreeAll && !note?.trim()) throw new EvidenceError("Explain the disagreement in a note.");
  await db
    .update(evidenceRecords)
    .set({ checkFields: fields, checkResult: agreeAll ? "agree" : "disagree", checkNote: note, checkedBy: adminId, checkedAt: new Date(), codingStatus: agreeAll ? "checked" : "disputed" })
    .where(eq(evidenceRecords.id, recordId));
  return { disputed: !agreeAll };
}

/** After the coding is fixed (or the dispute is settled), the record becomes checked. */
export async function resolveDispute(recordId: string, note: string, adminId: string) {
  const r = await db.query.evidenceRecords.findFirst({ where: eq(evidenceRecords.id, recordId) });
  if (!r || r.codingStatus !== "disputed") throw new EvidenceError("Only disputed records can be resolved.");
  if (!note.trim()) throw new EvidenceError("Say how the disagreement was resolved.");
  await db
    .update(evidenceRecords)
    .set({ codingStatus: "checked", checkNote: `${r.checkNote ? r.checkNote + " · " : ""}Resolved: ${note.trim()}`, checkResult: "agree", updatedAt: new Date() })
    .where(eq(evidenceRecords.id, recordId));
  return { resolvedBy: adminId };
}

// ─── Findings ─────────────────────────────────────────────────────────────
async function guardContext(studyId: string) {
  const a = await studyAnalysis(studyId);
  if (!a) throw new EvidenceError("Study not found.");
  const allowed = allowedNumbers(a.matrix);
  return { a, allowed };
}

function mergeWarnings(next: GuardWarning[], prev: GuardWarning[]): GuardWarning[] {
  return next.map((w) => ({ ...w, acknowledged: prev.some((p) => p.code === w.code && p.phrase === w.phrase && p.acknowledged) || undefined }));
}

/** Citation problems are stored as warnings too, so they block approval until fixed. */
function citationWarnings(codes: string[], records: { recordCode: string; included: boolean; codingStatus: string }[]): GuardWarning[] {
  const out: GuardWarning[] = [];
  if (!codes.length) out.push({ code: "citation", message: "The finding must cite at least one record.", phrase: "(no citations)" });
  for (const c of codes) {
    const r = records.find((x) => x.recordCode === c);
    if (!r) out.push({ code: "citation", message: `Cited record ${c} does not exist in this study.`, phrase: c });
    else if (!r.included) out.push({ code: "citation", message: `Cited record ${c} is excluded.`, phrase: c });
  }
  return out;
}

export async function draftFindings(studyId: string, questionId: string) {
  const bundle = await getStudyBundle(studyId);
  const q = bundle?.questions.find((x) => x.id === questionId);
  if (!bundle || !q) throw new EvidenceError("Research question not found.");
  const { a, allowed } = await guardContext(studyId);
  const entityName = new Map(bundle.entities.map((e) => [e.id, e.name]));
  const citable = a.records
    .filter((r) => r.included && r.codingStatus === "checked")
    .map((r) => ({ recordCode: r.recordCode, entityId: r.entityId, entityName: entityName.get(r.entityId) ?? "", themeKeys: r.themeKeys, text: r.translationEn ?? r.text }));
  const { result } = await draftFindingsAI({
    question: q.question,
    section: q.reportSection as ReportSection,
    matrix: a.matrix,
    themeLabels: Object.fromEntries(bundle.themes.map((t) => [t.key, t.label])),
    citable,
  });
  // Replace earlier AI drafts for this question; keep human-written and approved ones.
  await db.delete(evidenceFindings).where(and(eq(evidenceFindings.researchQuestionId, questionId), eq(evidenceFindings.status, "draft"), eq(evidenceFindings.generatedBy, "ai")));
  const approvedCount = (await getFindings(studyId)).filter((f) => f.researchQuestionId === questionId && f.status === "approved").length;
  const room = Math.max(0, 3 - approvedCount);
  const created: string[] = [];
  for (const [i, s] of result.sentences.slice(0, room).entries()) {
    const ids = s.cited_record_codes.map((c) => a.records.find((r) => r.recordCode === c)?.id).filter((x): x is string => !!x);
    const warnings = [...citationWarnings(s.cited_record_codes, a.records), ...guardFinding(s.text, { allowedNumbers: allowed.numbers, allowedPercents: allowed.percents })];
    const [row] = await db
      .insert(evidenceFindings)
      .values({ studyId, researchQuestionId: questionId, reportSection: q.reportSection, text: s.text, support: s.support, citedRecordIds: ids, guardWarnings: warnings, status: "draft", generatedBy: "ai", sort: i })
      .returning({ id: evidenceFindings.id });
    created.push(row.id);
  }
  // Every cited record joins the QA sample.
  await refreshQaSample(studyId);
  return { created: created.length, caveats: result.caveats, limited: result.sentences.length > room };
}

export async function saveFinding(studyId: string, f: { id?: string; questionId: string; text: string; support: Support; citedCodes: string[] }) {
  const bundle = await getStudyBundle(studyId);
  const q = bundle?.questions.find((x) => x.id === f.questionId);
  if (!bundle || !q) throw new EvidenceError("Research question not found.");
  const text = f.text.trim();
  if (text.length < 20) throw new EvidenceError("Write the finding as a full sentence.");
  const { a, allowed } = await guardContext(studyId);
  const codes = [...new Set(f.citedCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  const ids = codes.map((c) => a.records.find((r) => r.recordCode === c)?.id).filter((x): x is string => !!x);
  const prev = f.id ? await db.query.evidenceFindings.findFirst({ where: eq(evidenceFindings.id, f.id) }) : null;
  if (f.id && !prev) throw new EvidenceError("Finding not found.");
  if (prev?.status === "approved") throw new EvidenceError("Approved findings cannot be edited; reject it first.");
  const open = (await getFindings(studyId)).filter((x) => x.researchQuestionId === f.questionId && x.status !== "rejected" && x.id !== f.id).length;
  if (!f.id && open >= 3) throw new EvidenceError("A research question can have at most three findings.");
  const warnings = mergeWarnings([...citationWarnings(codes, a.records), ...guardFinding(text, { allowedNumbers: allowed.numbers, allowedPercents: allowed.percents })], (prev?.guardWarnings ?? []) as GuardWarning[]);
  const values = { researchQuestionId: f.questionId, reportSection: q.reportSection, text, support: f.support, citedRecordIds: ids, guardWarnings: warnings, updatedAt: new Date() };
  if (prev) await db.update(evidenceFindings).set({ ...values, generatedBy: "human" }).where(eq(evidenceFindings.id, prev.id));
  else await db.insert(evidenceFindings).values({ studyId, ...values, status: "draft", generatedBy: "human" });
  await refreshQaSample(studyId);
}

export async function acknowledgeWarning(findingId: string, index: number) {
  const f = await db.query.evidenceFindings.findFirst({ where: eq(evidenceFindings.id, findingId) });
  if (!f) throw new EvidenceError("Finding not found.");
  const w = [...(f.guardWarnings as GuardWarning[])];
  if (!w[index]) throw new EvidenceError("Warning not found.");
  if (w[index].code === "citation") throw new EvidenceError("Citation problems must be fixed, not acknowledged.");
  w[index] = { ...w[index], acknowledged: true };
  await db.update(evidenceFindings).set({ guardWarnings: w }).where(eq(evidenceFindings.id, findingId));
}

/** Approval rules: no open guard warnings, at least one citation, every cited record included and checked, ≤ 3 per question. */
export async function approveFinding(findingId: string, adminId: string) {
  const f = await db.query.evidenceFindings.findFirst({ where: eq(evidenceFindings.id, findingId) });
  if (!f) throw new EvidenceError("Finding not found.");
  if (f.status === "approved") return f;
  const open = (f.guardWarnings as GuardWarning[]).filter((w) => !w.acknowledged);
  if (open.length) throw new EvidenceError(`Resolve or acknowledge ${open.length} guard warning${open.length === 1 ? "" : "s"} first.`);
  if (!f.citedRecordIds.length) throw new EvidenceError("Cite at least one record.");
  const cited = await db.select().from(evidenceRecords).where(inArray(evidenceRecords.id, f.citedRecordIds));
  const notReady = cited.filter((r) => !r.included || r.codingStatus !== "checked");
  if (notReady.length || cited.length !== f.citedRecordIds.length) {
    throw new EvidenceError(`Every cited record must be included and checked in QA first (${notReady.map((r) => r.recordCode).join(", ") || "missing records"}).`);
  }
  const approved = (await getFindings(f.studyId)).filter((x) => x.researchQuestionId === f.researchQuestionId && x.status === "approved").length;
  if (approved >= 3) throw new EvidenceError("This research question already has three approved findings.");
  const [row] = await db.update(evidenceFindings).set({ status: "approved", approvedBy: adminId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(evidenceFindings.id, findingId)).returning();
  return row;
}

export async function rejectFinding(findingId: string) {
  const [row] = await db.update(evidenceFindings).set({ status: "rejected", approvedBy: null, approvedAt: null, updatedAt: new Date() }).where(eq(evidenceFindings.id, findingId)).returning();
  return row;
}

export async function setAppendixPublished(studyId: string, value: boolean) {
  await db.update(evidenceStudies).set({ appendixPublished: value, updatedAt: new Date() }).where(eq(evidenceStudies.id, studyId));
}

export async function studyCompanyId(studyId: string): Promise<string | null> {
  const s = await db.query.evidenceStudies.findFirst({ where: eq(evidenceStudies.id, studyId), columns: { companyId: true } });
  return s?.companyId ?? null;
}

export async function recordStudyId(recordId: string): Promise<string | null> {
  const r = await db.query.evidenceRecords.findFirst({ where: eq(evidenceRecords.id, recordId), columns: { studyId: true } });
  return r?.studyId ?? null;
}

export async function findingStudyId(findingId: string): Promise<string | null> {
  const r = await db.query.evidenceFindings.findFirst({ where: eq(evidenceFindings.id, findingId), columns: { studyId: true } });
  return r?.studyId ?? null;
}

export { getRecords, toLite };
