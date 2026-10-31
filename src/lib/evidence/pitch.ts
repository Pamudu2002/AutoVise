import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { CustomerEvidenceItem, Pitch } from "@/lib/ai/schemas";
import { revalidateCompany } from "@/lib/cache";
import { db } from "@/lib/db";
import { companies, predictions } from "@/lib/db/schema";
import { fmtMonthYear } from "@/lib/format";
import { approvedFindingsForCompany } from "./data";
import type { ReportSection } from "./types";

const SECTION_MAP: Partial<Record<ReportSection, CustomerEvidenceItem["section"]>> = {
  value_perception: "competitive_positioning",
  multi_sim_moat: "competitive_positioning",
  fixed_broadband: "industry_overview",
  investment_risks: "risks",
};

/** Approved findings, mapped to pitch sections, each with its attribution caveat. */
export async function customerEvidenceFor(companyId: string, slug: string): Promise<CustomerEvidenceItem[]> {
  const rows = await approvedFindingsForCompany(companyId);
  return rows
    .filter((r) => SECTION_MAP[r.finding.reportSection])
    .map((r) => ({
      section: SECTION_MAP[r.finding.reportSection]!,
      text: r.finding.text,
      support: r.finding.support,
      attribution: `Exploratory customer-evidence study, ${fmtMonthYear(r.study.collectionDate)}, n = ${r.n}`,
      studyId: r.study.id,
      appendixPath: r.study.appendixPublished ? `/companies/${slug}/evidence` : null,
    }));
}

/**
 * company/pitch.refresh: re-attaches approved findings to the draft and published pitches. Text only —
 * prediction numbers and inputs_hash are never touched.
 */
export async function refreshCompanyPitch(companyId: string): Promise<{ updated: number }> {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { slug: true } });
  if (!company) return { updated: 0 };
  const items = await customerEvidenceFor(companyId, company.slug);
  const rows = await db
    .select({ id: predictions.id, pitch: predictions.pitch })
    .from(predictions)
    .where(and(eq(predictions.companyId, companyId), inArray(predictions.status, ["draft", "published"])));
  let updated = 0;
  for (const r of rows) {
    if (!r.pitch) continue;
    const next: Pitch = { ...r.pitch, customerEvidence: items };
    await db.update(predictions).set({ pitch: next }).where(eq(predictions.id, r.id));
    updated++;
  }
  revalidateCompany(company.slug);
  return { updated };
}
