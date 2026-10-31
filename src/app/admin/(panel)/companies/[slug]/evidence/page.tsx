import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMain } from "@/components/admin/page-header";
import { StudiesList } from "@/components/evidence/studies-list";
import { CompanyLogo } from "@/components/company-logo";
import { can, requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { studyRows } from "@/lib/evidence/studies";
import { TEMPLATES } from "@/lib/evidence/templates/telecom-sl";

export const metadata = { title: "Customer evidence" };
export const dynamic = "force-dynamic";

export default async function CompanyEvidencePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePageAdmin();
  const { slug } = await params;
  const c = await db.query.companies.findFirst({ where: eq(companies.slug, slug) });
  if (!c) notFound();
  const rows = await studyRows(c.id);
  return (
    <AdminMain max={1200}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <CompanyLogo {...c} size={48} decorative />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>{c.name}</h1>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            <span className="num">{c.ticker}</span> · Customer-evidence studies
          </span>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Company sections">
        <Link className="tab" href={`/admin/companies?edit=${c.slug}`} role="tab" aria-selected="false">
          Details
        </Link>
        <Link className="tab" href={`/admin/companies/${c.slug}/reports`} role="tab" aria-selected="false">
          Reports
        </Link>
        <Link className="tab" href={`/admin/companies?price=${c.slug}`} role="tab" aria-selected="false">
          Prices
        </Link>
        <Link className="tab" href={`/admin/predictions?company=${c.slug}`} role="tab" aria-selected="false">
          Prediction
        </Link>
        <span className="tab on" role="tab" aria-selected="true">
          Customer evidence
        </span>
      </div>
      <StudiesList
        rows={rows}
        companies={[{ slug: c.slug, name: c.name }]}
        fixedCompany={c.slug}
        templates={Object.values(TEMPLATES).map((t) => ({ key: t.key, name: t.name, description: t.description }))}
        canWrite={can(user.role, "evidence.write")}
      />
    </AdminMain>
  );
}
