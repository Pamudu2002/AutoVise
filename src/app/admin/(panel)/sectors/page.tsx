import { asc, count } from "drizzle-orm";
import { SectorsAdmin } from "@/components/admin/sectors-admin";
import { can, requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { companies, sectors } from "@/lib/db/schema";

export const metadata = { title: "Sectors" };
export const dynamic = "force-dynamic";

export default async function SectorsPage() {
  const user = await requirePageAdmin();
  const [rows, counts] = await Promise.all([
    db.select().from(sectors).orderBy(asc(sectors.name)),
    db.select({ sectorId: companies.sectorId, n: count() }).from(companies).groupBy(companies.sectorId),
  ]);
  return (
    <SectorsAdmin
      canEdit={can(user.role, "sectors.write")}
      rows={rows.map((s) => ({
        id: s.id,
        name: s.name,
        pe: s.benchmarkPe,
        growth: s.benchmarkGrowth,
        roe: s.benchmarkRoe,
        notes: s.notes,
        dcf: s.dcfApplicable,
        companies: counts.find((c) => c.sectorId === s.id)?.n ?? 0,
        updatedAt: s.updatedAt.toISOString(),
      }))}
    />
  );
}

