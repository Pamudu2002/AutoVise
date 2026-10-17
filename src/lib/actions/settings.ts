"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { revalidateCompany } from "@/lib/cache";
import { db } from "@/lib/db";
import { companies, settings as settingsTable } from "@/lib/db/schema";
import { sendRecompute } from "@/lib/jobs";
import { appSettingsSchema, getSettings, type AppSettings } from "@/lib/settings";
import { run, type ActionResult } from "./result";

/** Saves settings. Valuation changes apply to the next recalculation, which is queued for every company. */
export async function saveSettings(input: AppSettings): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("settings.write");
    const next = appSettingsSchema.parse(input);
    const before = await getSettings();
    await db
      .insert(settingsTable)
      .values({ id: 1, data: next, updatedBy: admin.id, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settingsTable.id, set: { data: next, updatedBy: admin.id, updatedAt: new Date() } });
    await audit(admin, "settings.updated", "settings", "1", before, next);
    if (JSON.stringify(before.valuation) !== JSON.stringify(next.valuation)) {
      const all = await db.select({ id: companies.id }).from(companies);
      for (const c of all) await sendRecompute(c.id, "Valuation settings changed");
    }
    revalidatePath("/", "layout");
    revalidateCompany();
  }, "Settings saved. They apply from the next recalculation.");
}
