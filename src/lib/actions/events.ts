"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { companyEvents } from "@/lib/db/schema";
import { sendRecompute } from "@/lib/jobs";
import { run, UserError, type ActionResult } from "./result";

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid("Choose a company."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  title: z.string().trim().min(4, "Give the event a title.").max(160),
  body: z.string().trim().max(1000).optional(),
  sentiment: z.coerce.number().min(-1).max(1),
  sourceUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\//.test(v), "Source must be a web address.")
    .optional(),
});

/** Company news is a qualitative input: saving or deleting an event recomputes the company. */
export async function saveEvent(input: z.input<typeof eventSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("events.write");
    const d = eventSchema.parse(input);
    const values = { companyId: d.companyId, date: d.date, title: d.title, body: d.body || null, sentiment: d.sentiment, sourceUrl: d.sourceUrl || null, updatedAt: new Date() };
    if (d.id) {
      const before = await db.query.companyEvents.findFirst({ where: eq(companyEvents.id, d.id) });
      if (!before) throw new UserError("Event not found.");
      await db.update(companyEvents).set(values).where(eq(companyEvents.id, d.id));
      await audit(admin, "event.updated", "company_event", d.id, before, values);
      if (before.companyId !== d.companyId) await sendRecompute(before.companyId, "Company event moved");
    } else {
      const [row] = await db.insert(companyEvents).values({ ...values, createdBy: admin.id }).returning();
      await audit(admin, "event.created", "company_event", row.id, null, values);
    }
    await sendRecompute(d.companyId, `Company event: ${d.title}`);
    revalidatePath("/admin/events");
  }, "Event saved. The prediction is being recalculated.");
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("events.write");
    const before = await db.query.companyEvents.findFirst({ where: eq(companyEvents.id, id) });
    if (!before) throw new UserError("Event not found.");
    await db.delete(companyEvents).where(eq(companyEvents.id, id));
    await audit(admin, "event.deleted", "company_event", id, before, null);
    await sendRecompute(before.companyId, "Company event deleted");
    revalidatePath("/admin/events");
  }, "Event deleted.");
}
