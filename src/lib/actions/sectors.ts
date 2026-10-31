"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { companies, sectors } from "@/lib/db/schema";
import { sendRecompute } from "@/lib/jobs";
import { run, UserError, type ActionResult } from "./result";

const sectorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  benchmarkPe: z.coerce.number().min(1).max(80),
  /** Entered in percent in the form. */
  benchmarkGrowthPct: z.coerce.number().min(-20).max(50),
  benchmarkRoePct: z.coerce.number().min(-50).max(100),
  notes: z.string().trim().max(300).optional(),
  dcfApplicable: z.boolean().default(true),
});

export async function saveSector(input: z.input<typeof sectorSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("sectors.write");
    const d = sectorSchema.parse(input);
    const values = { name: d.name, benchmarkPe: d.benchmarkPe, benchmarkGrowth: d.benchmarkGrowthPct / 100, benchmarkRoe: d.benchmarkRoePct / 100, notes: d.notes || null, dcfApplicable: d.dcfApplicable, updatedAt: new Date() };
    const dupe = await db.query.sectors.findFirst({ where: eq(sectors.name, d.name) });
    if (dupe && dupe.id !== d.id) throw new UserError(`A sector called ${d.name} already exists.`);
    if (d.id) {
      const before = await db.query.sectors.findFirst({ where: eq(sectors.id, d.id) });
      await db.update(sectors).set(values).where(eq(sectors.id, d.id));
      await audit(admin, "sector.updated", "sector", d.id, before, values);
      // Benchmarks feed every company in the sector.
      const members = await db.select({ id: companies.id }).from(companies).where(eq(companies.sectorId, d.id));
      for (const m of members) await sendRecompute(m.id, `Sector benchmarks for ${d.name} changed`);
    } else {
      const [row] = await db.insert(sectors).values(values).returning();
      await audit(admin, "sector.created", "sector", row.id, null, values);
    }
    revalidatePath("/admin/sectors");
  }, "Sector saved.");
}

export async function deleteSector(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("sectors.write");
    const [{ n }] = await db.select({ n: count() }).from(companies).where(eq(companies.sectorId, id));
    if (n > 0) throw new UserError(`${n} compan${n === 1 ? "y uses" : "ies use"} this sector. Move them first.`);
    const before = await db.query.sectors.findFirst({ where: eq(sectors.id, id) });
    await db.delete(sectors).where(eq(sectors.id, id));
    await audit(admin, "sector.deleted", "sector", id, before, null);
    revalidatePath("/admin/sectors");
  }, "Sector deleted.");
}
