import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { revalidateCompany } from "@/lib/cache";
import { db } from "@/lib/db";
import { companies, predictions } from "@/lib/db/schema";

/** Publishes a prediction: the previous published one is archived (kept for the track record). */
export async function publishPrediction(predictionId: string, adminId: string | null) {
  const p = await db.query.predictions.findFirst({ where: eq(predictions.id, predictionId) });
  if (!p) throw new Error("Prediction not found.");
  if (p.status === "published") return p;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(predictions)
      .set({ status: "archived" })
      .where(and(eq(predictions.companyId, p.companyId), eq(predictions.status, "published"), ne(predictions.id, p.id)));
    await tx.update(predictions).set({ status: "published", publishedAt: now, publishedBy: adminId }).where(eq(predictions.id, p.id));
  });
  const company = await db.query.companies.findFirst({ where: eq(companies.id, p.companyId), columns: { slug: true } });
  revalidateCompany(company?.slug);
  return { ...p, status: "published" as const, publishedAt: now };
}
