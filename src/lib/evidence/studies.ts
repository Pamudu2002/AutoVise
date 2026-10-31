import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import type { StudyRow } from "@/components/evidence/studies-list";
import { db } from "@/lib/db";
import { companies, evidenceStudies } from "@/lib/db/schema";

/** Study rows for the admin lists, optionally for one company. */
export async function studyRows(companyId?: string): Promise<StudyRow[]> {
  const rows = await db
    .select({
      id: evidenceStudies.id,
      title: evidenceStudies.title,
      company: companies.name,
      companySlug: companies.slug,
      ticker: companies.ticker,
      status: evidenceStudies.status,
      collectionDate: evidenceStudies.collectionDate,
      appendixPublished: evidenceStudies.appendixPublished,
      records: sql<number>`(select count(*) from evidence_records r where r.study_id = ${evidenceStudies.id})`.mapWith(Number),
      included: sql<number>`(select count(*) from evidence_records r where r.study_id = ${evidenceStudies.id} and r.included)`.mapWith(Number),
      approved: sql<number>`(select count(*) from evidence_findings f where f.study_id = ${evidenceStudies.id} and f.status = 'approved')`.mapWith(Number),
    })
    .from(evidenceStudies)
    .innerJoin(companies, eq(companies.id, evidenceStudies.companyId))
    .where(companyId ? eq(evidenceStudies.companyId, companyId) : undefined)
    .orderBy(desc(evidenceStudies.createdAt));
  return rows;
}
