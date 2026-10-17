import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminMain } from "@/components/admin/page-header";
import { ReportUploader } from "@/components/admin/report-uploader";
import { ReportsTable } from "@/components/admin/reports-table";
import { CompanyLogo } from "@/components/company-logo";
import { StatusPill } from "@/components/ui/figures";
import { can, requirePageAdmin } from "@/lib/admin";
import { reportRows } from "@/lib/data/admin";
import { db } from "@/lib/db";
import { companies, predictions, sectors } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const metadata = { title: "Company reports" };
export const dynamic = "force-dynamic";

export default async function CompanyReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePageAdmin();
  const { slug } = await params;
  const [row] = await db.select({ c: companies, sector: sectors.name }).from(companies).leftJoin(sectors, eq(sectors.id, companies.sectorId)).where(eq(companies.slug, slug)).limit(1);
  if (!row) notFound();
  const { c, sector } = row;
  const [rows, published] = await Promise.all([
    reportRows({ companyId: c.id }),
    db.query.predictions.findFirst({ where: and(eq(predictions.companyId, c.id), eq(predictions.status, "published")) }),
  ]);
  const busy = rows.some((r) => r.current.status === "processing" || r.current.status === "uploaded");
  const canWrite = can(user.role, "reports.write");

  return (
    <AdminMain>
      <AutoRefresh when={busy} />
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <CompanyLogo {...c} size={48} decorative />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>{c.name}</h1>
          <span style={{ fontSize: 13, color: "var(--muted)", display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span className="num">{c.ticker}</span> · {sector ?? "—"} · <StatusPill status={c.status} style={{ height: 20, fontSize: 11 }} />
          </span>
        </div>
        <Link className="btn btn-secondary" href={`/admin/predictions?company=${c.slug}`}>
          View prediction
        </Link>
      </div>
      <div className="tabs" role="tablist" aria-label="Company sections">
        <Link className="tab" href={`/admin/companies?edit=${c.slug}`} role="tab" aria-selected="false">
          Details
        </Link>
        <span className="tab on" role="tab" aria-selected="true">
          Reports
        </span>
        <Link className="tab" href={`/admin/companies?price=${c.slug}`} role="tab" aria-selected="false">
          Prices
        </Link>
        <Link className="tab" href={`/admin/predictions?company=${c.slug}`} role="tab" aria-selected="false">
          Prediction
        </Link>
      </div>
      {canWrite && <ReportUploader companyId={c.id} blobEnabled={env.hasBlob} />}
      <ReportsTable rows={rows} ticker={c.ticker} publishedTarget={published?.scenarios.base.y3 ?? null} currency={c.currency} blobEnabled={env.hasBlob} canWrite={canWrite} />
    </AdminMain>
  );
}
