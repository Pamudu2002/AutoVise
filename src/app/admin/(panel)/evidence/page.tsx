import { asc } from "drizzle-orm";
import { AdminMain, PageHeader } from "@/components/admin/page-header";
import { StudiesList } from "@/components/evidence/studies-list";
import { can, requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { studyRows } from "@/lib/evidence/studies";
import { TEMPLATES } from "@/lib/evidence/templates/telecom-sl";

export const metadata = { title: "Customer evidence" };
export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const user = await requirePageAdmin();
  const [rows, cos] = await Promise.all([
    studyRows(),
    db.select({ slug: companies.slug, name: companies.name }).from(companies).orderBy(asc(companies.name)),
  ]);
  return (
    <AdminMain max={1200}>
      <PageHeader
        title="Customer evidence"
        sub="Exploratory studies of public customer experiences. Approved findings add context to the pitch; they never change prices or predictions."
      />
      <StudiesList rows={rows} companies={cos} templates={Object.values(TEMPLATES).map((t) => ({ key: t.key, name: t.name, description: t.description }))} canWrite={can(user.role, "evidence.write")} />
    </AdminMain>
  );
}
