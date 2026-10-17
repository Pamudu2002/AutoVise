import { asc } from "drizzle-orm";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminMain, PageHeader } from "@/components/admin/page-header";
import { ReportUploader } from "@/components/admin/report-uploader";
import { ReportsTable } from "@/components/admin/reports-table";
import { can, requirePageAdmin } from "@/lib/admin";
import { reportRows } from "@/lib/data/admin";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { env } from "@/lib/env";
import Link from "next/link";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const FILTERS = [
  ["all", "All"],
  ["attention", "Needs attention"],
  ["processing", "Processing"],
  ["approved", "Approved"],
] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePageAdmin();
  const { status = "all" } = await searchParams;
  const [all, cos] = await Promise.all([reportRows(), db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(asc(companies.name))]);
  const rows = all.filter((r) =>
    status === "attention" ? ["review", "failed"].includes(r.current.status) : status === "processing" ? ["uploaded", "processing"].includes(r.current.status) : status === "approved" ? r.current.status === "approved" : true,
  );
  const canWrite = can(user.role, "reports.write");
  return (
    <AdminMain>
      <AutoRefresh when={all.some((r) => r.current.status === "processing" || r.current.status === "uploaded")} />
      <PageHeader title="Reports" sub="Every company's financial reports, their versions and processing status." />
      {canWrite && cos.length > 0 && <ReportUploader companies={cos} blobEnabled={env.hasBlob} />}
      <div className="seg" role="group" aria-label="Status filter" style={{ alignSelf: "flex-start" }}>
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={k === "all" ? "/admin/reports" : `/admin/reports?status=${k}`} className={`seg-btn${status === k ? " on" : ""}`} aria-current={status === k ? "page" : undefined} style={{ padding: "0 12px" }}>
            {label}
          </Link>
        ))}
      </div>
      <ReportsTable rows={rows} blobEnabled={env.hasBlob} canWrite={canWrite} showCompany />
    </AdminMain>
  );
}
