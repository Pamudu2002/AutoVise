import { eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceAppendix } from "@/components/evidence/evidence-appendix";
import { Disclaimer } from "@/components/ui/figures";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { appendixFor, getFindings, getStudyBundle, publishedStudyForCompany } from "@/lib/evidence/data";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Params = { slug: string };

async function load(slug: string) {
  const company = await db.query.companies.findFirst({ where: eq(companies.slug, slug) });
  if (!company) return null;
  const study = await publishedStudyForCompany(company.id);
  return { company, study };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d?.study) return { title: "Customer evidence", robots: { index: false } };
  return {
    title: `${d.company.name} customer evidence — methodology`,
    description: `How the exploratory customer-evidence study for ${d.company.name} was collected, coded and checked, with its limitations.`,
  };
}

/** Public methodology appendix for a company's published customer-evidence study (PLAN2 §7.6). */
export default async function CompanyEvidencePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d?.study) notFound();
  const session = await auth();
  if (d.company.status !== "published" && !session?.user) notFound();
  const [data, findings, bundle, settings] = await Promise.all([appendixFor(d.study.id), getFindings(d.study.id), getStudyBundle(d.study.id), getSettings()]);
  if (!data || !bundle) notFound();
  const question = new Map(bundle.questions.map((q) => [q.id, q.question]));
  const approved = findings.filter((f) => f.status === "approved");

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 80, display: "flex", flexDirection: "column", gap: 28, maxWidth: 1040 }}>
      <Link href={`/companies/${slug}`} style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 14, color: "var(--muted)", textDecoration: "none" }}>
        <ChevronLeft size={16} aria-hidden />
        {d.company.name}
      </Link>
      <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="eyebrow">Customer evidence · methodology appendix</span>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, fontWeight: 600 }}>{data.title}</h1>
        <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.6, maxWidth: 760 }}>
          Exploratory customer evidence that adds context to the {d.company.name} investment case. It is not a representative survey, it does not rank operators, and it does not change the price prediction.
        </p>
        <Disclaimer text={settings.disclaimer.short} />
      </header>
      <EvidenceAppendix data={data} findings={approved.map((f) => ({ question: (f.researchQuestionId && question.get(f.researchQuestionId)) || "", text: f.text, support: f.support }))} />
    </div>
  );
}
