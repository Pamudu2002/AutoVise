import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAdmin, roleLabel } from "@/lib/admin";
import { db } from "@/lib/db";
import { financialReports, predictions, reportVersions } from "@/lib/db/schema";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · AutoVise Admin" }, robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageAdmin();
  const [[reports], [drafts]] = await Promise.all([
    db
      .select({ n: count() })
      .from(financialReports)
      .innerJoin(reportVersions, eq(reportVersions.id, financialReports.currentVersionId))
      .where(and(isNull(financialReports.deletedAt), inArray(reportVersions.status, ["review", "failed"]))),
    db.select({ n: count() }).from(predictions).where(eq(predictions.status, "draft")),
  ]);
  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role, roleLabel: roleLabel[user.role] }} badges={{ reports: reports?.n ?? 0, predictions: drafts?.n ?? 0 }}>
      {children}
    </AdminShell>
  );
}
