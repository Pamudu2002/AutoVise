"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin";
import { revalidateCompany } from "@/lib/cache";
import { db } from "@/lib/db";
import { companies, evidenceStudies, evidenceTargets } from "@/lib/db/schema";
import type { ColumnMapping } from "@/lib/evidence/import";
import * as svc from "@/lib/evidence/service";
import { EXCLUSIONS, PLATFORMS, PRODUCTS, QA_FIELDS, SENTIMENTS, STUDY_STATUSES, SUPPORTS, type QaField } from "@/lib/evidence/types";
import { studySetupSchema } from "@/lib/evidence/validation";
import { sendEvidenceCoding, sendEvidenceEmbed, sendPitchRefresh } from "@/lib/jobs";
import { run, UserError, type ActionResult } from "./result";

const id = z.string().uuid();

/** The study's company, for revalidation. Throws when the study does not exist. */
async function studyRef(studyId: string) {
  const [row] = await db
    .select({ id: evidenceStudies.id, companyId: evidenceStudies.companyId, slug: companies.slug })
    .from(evidenceStudies)
    .innerJoin(companies, eq(companies.id, evidenceStudies.companyId))
    .where(eq(evidenceStudies.id, id.parse(studyId)));
  if (!row) throw new UserError("Study not found.");
  return row;
}

function refresh(ref: { id: string; slug: string }, publicToo = false) {
  revalidatePath(`/admin/evidence/${ref.id}`, "layout");
  revalidatePath(`/admin/companies/${ref.slug}/evidence`);
  if (publicToo) {
    revalidateCompany(ref.slug);
    revalidatePath(`/companies/${ref.slug}/evidence`);
  }
}

async function recordRef(recordId: string) {
  const studyId = await svc.recordStudyId(id.parse(recordId));
  if (!studyId) throw new UserError("Record not found.");
  return studyRef(studyId);
}

async function findingRef(findingId: string) {
  const studyId = await svc.findingStudyId(id.parse(findingId));
  if (!studyId) throw new UserError("Finding not found.");
  return studyRef(studyId);
}

// ─── Studies ──────────────────────────────────────────────────────────────
const createSchema = z.object({
  companySlug: z.string().min(1),
  title: z.string().trim().min(3).max(140),
  collectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  templateKey: z.string().nullable(),
});

export async function createEvidenceStudy(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const d = createSchema.parse(input);
    const company = await db.query.companies.findFirst({ where: eq(companies.slug, d.companySlug) });
    if (!company) throw new UserError("Company not found.");
    const study = await svc.createStudy({ companyId: company.id, title: d.title, collectionDate: d.collectionDate, templateKey: d.templateKey }, admin.id);
    await audit(admin, "evidence.study.created", "evidence_study", study.id, null, { title: d.title, templateKey: d.templateKey });
    revalidatePath(`/admin/companies/${company.slug}/evidence`);
    return { id: study.id };
  }, "Study created.");
}

export async function saveStudySetup(studyId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const d = studySetupSchema.parse(input);
    await svc.saveSetup(ref.id, d);
    await audit(admin, "evidence.study.setup", "evidence_study", ref.id, null, d);
    refresh(ref);
  }, "Setup saved.");
}

export async function setStudyStatus(studyId: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const s = z.enum(STUDY_STATUSES).parse(status);
    await svc.setStatus(ref.id, s);
    await audit(admin, "evidence.study.status", "evidence_study", ref.id, null, { status: s });
    refresh(ref);
  }, "Status updated.");
}

export async function saveEvidenceGroup(studyId: string, input: { id?: string; name: string }): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    await svc.saveGroup(ref.id, z.object({ id: id.optional(), name: z.string().max(80) }).parse(input));
    await audit(admin, "evidence.group.saved", "evidence_study", ref.id, null, input);
    refresh(ref);
  }, "Group saved.");
}

const entitySchema = z.object({ id: id.optional(), groupId: id, name: z.string().max(80), isSubject: z.boolean(), requiresGeoCheck: z.boolean() });
export async function saveEvidenceEntity(studyId: string, input: z.input<typeof entitySchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const d = entitySchema.parse(input);
    await svc.saveEntity(ref.id, d);
    await audit(admin, "evidence.entity.saved", "evidence_study", ref.id, null, d);
    refresh(ref);
  }, "Entity saved.");
}

export async function deleteEvidenceEntity(studyId: string, entityId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    await svc.deleteEntity(ref.id, id.parse(entityId));
    await audit(admin, "evidence.entity.deleted", "evidence_study", ref.id, { entityId }, null);
    refresh(ref);
  }, "Entity removed.");
}

const targetSchema = z.object({
  id: id.optional(),
  label: z.string().trim().min(2).max(120),
  groupId: id.nullable(),
  product: z.enum(PRODUCTS).nullable(),
  platform: z.enum(PLATFORMS).nullable(),
  perEntity: z.boolean(),
  targetMin: z.coerce.number().int().min(0).max(10000),
  targetMax: z.coerce.number().int().min(0).max(10000),
});
export async function saveEvidenceTarget(studyId: string, input: z.input<typeof targetSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const d = targetSchema.parse(input);
    await svc.saveTarget(ref.id, d);
    await audit(admin, "evidence.target.saved", "evidence_study", ref.id, null, d);
    refresh(ref);
  }, "Target saved.");
}

export async function deleteEvidenceTarget(studyId: string, targetId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    await db.delete(evidenceTargets).where(eq(evidenceTargets.id, id.parse(targetId)));
    await audit(admin, "evidence.target.deleted", "evidence_study", ref.id, { targetId }, null);
    refresh(ref);
  }, "Target removed.");
}

// ─── Screening ────────────────────────────────────────────────────────────
const screeningSchema = z.object({
  decision: z.enum(["pending", "selected", "excluded"]),
  reason: z.string().trim().max(500).nullable(),
  searchTerms: z.array(z.string().max(200)).max(40),
  sortMethod: z.string().trim().max(120).nullable(),
  coverageNote: z.string().trim().max(500).nullable(),
});
export async function saveScreening(studyId: string, platform: string, input: z.input<typeof screeningSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const p = z.enum(PLATFORMS).parse(platform);
    const d = screeningSchema.parse(input);
    await svc.saveScreening(ref.id, p, d, admin.id);
    await audit(admin, "evidence.screening.saved", "evidence_study", ref.id, null, { platform: p, ...d });
    refresh(ref, true);
  }, "Screening saved.");
}

// ─── Records ──────────────────────────────────────────────────────────────
const importSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "The file has no rows.").max(2000, "Import at most 2,000 rows at a time."),
  mapping: z.record(z.string(), z.string()),
});

/** Validates the file without writing anything. */
export async function previewImport(studyId: string, input: z.input<typeof importSchema>) {
  return run(async () => {
    await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const d = importSchema.parse(input);
    const res = await svc.importRecords(ref.id, { rows: d.rows, mapping: d.mapping as ColumnMapping }, "", false);
    return { valid: res.valid.length, errors: res.errors, warnings: res.warnings, autoExcluded: res.autoExcluded, codes: res.valid.slice(0, 200).map((r) => r.recordCode ?? "") };
  });
}

export async function commitImport(studyId: string, input: z.input<typeof importSchema>) {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const d = importSchema.parse(input);
    const res = await svc.importRecords(ref.id, { rows: d.rows, mapping: d.mapping as ColumnMapping }, admin.id, true);
    if (res.errors.length) throw new UserError(`${res.errors.length} row${res.errors.length === 1 ? " has" : "s have"} errors. Fix them and import again.`);
    await audit(admin, "evidence.records.imported", "evidence_study", ref.id, null, { inserted: res.inserted, updated: res.updated, autoExcluded: res.autoExcluded });
    await sendEvidenceEmbed(ref.id);
    refresh(ref);
    return { inserted: res.inserted, updated: res.updated, autoExcluded: res.autoExcluded };
  });
}

export async function saveEvidenceRecord(studyId: string, recordId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const { id: rid, before } = await svc.saveRecord(ref.id, recordId ? id.parse(recordId) : null, input, admin.id);
    await audit(admin, recordId ? "evidence.record.updated" : "evidence.record.created", "evidence_record", rid, before ?? null, input);
    await sendEvidenceEmbed(ref.id);
    refresh(ref, true);
    return { id: rid };
  }, "Record saved.");
}

export async function setPublicExample(recordId: string, value: boolean): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.approve");
    const ref = await recordRef(recordId);
    await svc.setPublicExample(recordId, value);
    await audit(admin, "evidence.record.public_example", "evidence_record", recordId, null, { value });
    refresh(ref, true);
  }, value ? "Shown as an example in the appendix." : "Removed from the appendix examples.");
}

// ─── Coding ───────────────────────────────────────────────────────────────
export async function requestCoding(studyId: string, recordIds: string[]): Promise<ActionResult<{ queued: number }>> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const ids = z.array(id).min(1, "Select records to code.").max(1000).parse(recordIds);
    await sendEvidenceCoding(ref.id, ids);
    await audit(admin, "evidence.coding.requested", "evidence_study", ref.id, null, { count: ids.length });
    refresh(ref);
    return { queued: ids.length };
  }, "AI-assisted coding started. Suggestions appear as they are ready.");
}

const acceptSchema = z.object({
  themeKeys: z.array(z.string()).max(10),
  sentiment: z.enum(SENTIMENTS),
  switching: z.boolean(),
  switchingNote: z.string().trim().max(500).nullable(),
  product: z.enum(PRODUCTS),
  productEvidence: z.string().trim().max(500).nullable(),
  translationEn: z.string().trim().max(4000).nullable(),
  included: z.boolean(),
  exclusionReason: z.enum(EXCLUSIONS).nullable(),
});
export async function acceptCoding(recordId: string, input: z.input<typeof acceptSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await recordRef(recordId);
    const d = acceptSchema.parse(input);
    await svc.acceptCoding(recordId, d, admin.id);
    await audit(admin, "evidence.coding.accepted", "evidence_record", recordId, null, d);
    refresh(ref, true);
  }, "Coding saved.");
}

export async function rejectSuggestion(recordId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await recordRef(recordId);
    await svc.rejectSuggestion(recordId);
    await audit(admin, "evidence.coding.rejected", "evidence_record", recordId);
    refresh(ref);
  }, "Suggestion discarded.");
}

// ─── Duplicates ───────────────────────────────────────────────────────────
export async function markDuplicate(recordId: string, duplicateOfId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await recordRef(recordId);
    await svc.markDuplicate(recordId, id.parse(duplicateOfId));
    await audit(admin, "evidence.record.duplicate", "evidence_record", recordId, null, { duplicateOfId });
    refresh(ref, true);
  }, "Marked as a duplicate and excluded.");
}

export async function dismissDuplicate(studyId: string, a: string, b: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    await svc.dismissDuplicate(ref.id, id.parse(a), id.parse(b), admin.id);
    await audit(admin, "evidence.duplicate.dismissed", "evidence_study", ref.id, null, { a, b });
    refresh(ref);
  }, "Not a duplicate.");
}

export async function embedRecordsNow(studyId: string): Promise<ActionResult<{ embedded: number }>> {
  return run(async () => {
    await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const res = await svc.embedStudy(ref.id);
    refresh(ref);
    return res;
  });
}

// ─── QA ───────────────────────────────────────────────────────────────────
export async function refreshQaSample(studyId: string): Promise<ActionResult<{ size: number }>> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const res = await svc.refreshQaSample(ref.id);
    await audit(admin, "evidence.qa.sampled", "evidence_study", ref.id, null, res);
    refresh(ref);
    return res;
  }, "QA sample updated.");
}

const checkSchema = z.object({
  fields: z.object(Object.fromEntries(QA_FIELDS.map((f) => [f, z.enum(["agree", "disagree"])])) as Record<QaField, z.ZodEnum<{ agree: "agree"; disagree: "disagree" }>>),
  note: z.string().trim().max(1000).nullable(),
});
export async function submitCheck(recordId: string, input: z.input<typeof checkSchema>): Promise<ActionResult<{ disputed: boolean }>> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await recordRef(recordId);
    const d = checkSchema.parse(input);
    const res = await svc.submitCheck(recordId, d.fields, d.note, admin.id);
    await audit(admin, "evidence.qa.checked", "evidence_record", recordId, null, d);
    refresh(ref, true);
    return res;
  }, "Check saved.");
}

export async function resolveDispute(recordId: string, note: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await recordRef(recordId);
    await svc.resolveDispute(recordId, z.string().max(1000).parse(note), admin.id);
    await audit(admin, "evidence.qa.resolved", "evidence_record", recordId, null, { note });
    refresh(ref, true);
  }, "Dispute resolved.");
}

// ─── Findings ─────────────────────────────────────────────────────────────
export async function draftFindings(studyId: string, questionId: string): Promise<ActionResult<{ created: number; caveats: string[] }>> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const res = await svc.draftFindings(ref.id, id.parse(questionId));
    await audit(admin, "evidence.findings.drafted", "evidence_study", ref.id, null, { questionId, created: res.created });
    refresh(ref);
    return { created: res.created, caveats: res.caveats };
  });
}

const findingSchema = z.object({
  id: id.optional(),
  questionId: id,
  text: z.string().max(600),
  support: z.enum(SUPPORTS),
  citedCodes: z.array(z.string().max(12)).max(12),
});
export async function saveFinding(studyId: string, input: z.input<typeof findingSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.write");
    const ref = await studyRef(studyId);
    const d = findingSchema.parse(input);
    await svc.saveFinding(ref.id, d);
    await audit(admin, d.id ? "evidence.finding.updated" : "evidence.finding.created", "evidence_finding", d.id ?? null, null, d);
    refresh(ref);
  }, "Finding saved and re-checked.");
}

export async function acknowledgeWarning(findingId: string, index: number): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.approve");
    const ref = await findingRef(findingId);
    await svc.acknowledgeWarning(findingId, z.number().int().min(0).parse(index));
    await audit(admin, "evidence.finding.warning_acknowledged", "evidence_finding", findingId, null, { index });
    refresh(ref);
  }, "Warning acknowledged.");
}

export async function approveFinding(findingId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.approve");
    const ref = await findingRef(findingId);
    const row = await svc.approveFinding(findingId, admin.id);
    await audit(admin, "evidence.finding.approved", "evidence_finding", findingId, null, { text: row.text, cited: row.citedRecordIds });
    await sendPitchRefresh(ref.companyId);
    refresh(ref, true);
  }, "Finding approved. The pitch will show it shortly.");
}

export async function rejectFinding(findingId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.approve");
    const ref = await findingRef(findingId);
    const row = await svc.rejectFinding(findingId);
    await audit(admin, "evidence.finding.rejected", "evidence_finding", findingId, null, { text: row?.text });
    await sendPitchRefresh(ref.companyId);
    refresh(ref, true);
  }, "Finding rejected.");
}

export async function setAppendixPublished(studyId: string, value: boolean): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("evidence.approve");
    const ref = await studyRef(studyId);
    await svc.setAppendixPublished(ref.id, value);
    await audit(admin, value ? "evidence.appendix.published" : "evidence.appendix.unpublished", "evidence_study", ref.id);
    await sendPitchRefresh(ref.companyId);
    refresh(ref, true);
  }, value ? "Methodology appendix published." : "Appendix taken down.");
}
