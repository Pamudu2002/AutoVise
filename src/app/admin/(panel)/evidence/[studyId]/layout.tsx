import { and, count, eq } from "drizzle-orm";
import Link from "next/link";
import { AdminMain } from "@/components/admin/page-header";
import { StudyTabs } from "@/components/evidence/study-tabs";
import { db } from "@/lib/db";
import { evidenceFindings, evidenceRecords } from "@/lib/db/schema";
import { loadStudy } from "@/lib/evidence/page";
import { STATUS_STEPS } from "@/lib/evidence/types";
import { fmtDate } from "@/lib/format";

export default async function StudyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const { bundle } = await loadStudy(studyId);
  const { study, company } = bundle;
  const [[suggested], [qa], [drafts]] = await Promise.all([
    db.select({ n: count() }).from(evidenceRecords).where(and(eq(evidenceRecords.studyId, studyId), eq(evidenceRecords.codingStatus, "ai_suggested"))),
    db.select({ n: count() }).from(evidenceRecords).where(and(eq(evidenceRecords.studyId, studyId), eq(evidenceRecords.inQaSample, true), eq(evidenceRecords.codingStatus, "coded"))),
    db.select({ n: count() }).from(evidenceFindings).where(and(eq(evidenceFindings.studyId, studyId), eq(evidenceFindings.status, "draft"))),
  ]);
  const step = STATUS_STEPS.find((s) => s.key === study.status);
  return (
    <AdminMain max={1400} gap={16}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="eyebrow">
          <Link href={`/admin/companies/${company.slug}/evidence`} style={{ color: "inherit" }}>
            {company.name} · Customer evidence
          </Link>
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>{study.title}</h1>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          Collected {fmtDate(study.collectionDate)} · window {fmtDate(study.windowStart)} – {fmtDate(study.collectionDate)} · status <strong>{step?.label}</strong>
          {study.appendixPublished ? " · appendix published" : ""}
        </span>
      </div>
      <StudyTabs studyId={studyId} counts={{ coding: suggested?.n ?? 0, qa: qa?.n ?? 0, findings: drafts?.n ?? 0 }} />
      {children}
    </AdminMain>
  );
}
