"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { predictions } from "@/lib/db/schema";
import { sendRecompute } from "@/lib/jobs";
import { publishPrediction } from "@/lib/predictions/publish";
import { getSettings } from "@/lib/settings";
import { run, UserError, type ActionResult } from "./result";

export async function publishPredictionAction(predictionId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("predictions.publish");
    const p = await db.query.predictions.findFirst({ where: eq(predictions.id, predictionId) });
    if (!p) throw new UserError("Prediction not found.");
    if (p.status !== "draft") throw new UserError("Only drafts can be published.");
    const { publishing } = await getSettings();
    if (p.confidence < publishing.minConfidenceToPublish) {
      throw new UserError(`Confidence ${p.confidence} is below the minimum of ${publishing.minConfidenceToPublish} needed to publish. Add data or adjust the setting.`);
    }
    await publishPrediction(p.id, admin.id);
    await audit(admin, "prediction.published", "prediction", p.id, null, { version: p.version, base: p.scenarios.base.y3 });
    revalidatePath("/admin", "layout");
  }, "Prediction published.");
}

/** Rebuilds the company's prediction now, even if nothing changed (e.g. to get a fresh pitch). */
export async function rerunPrediction(companyId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("predictions.rerun");
    await sendRecompute(companyId, `Rerun by ${admin.name}`, true);
    await audit(admin, "prediction.rerun", "company", companyId);
    revalidatePath("/admin/predictions");
  }, "Recalculation started. The new draft appears here in a moment.");
}

const note = z.string().trim().min(5, "Write a short note.").max(1000);

export async function addOverrideNote(predictionId: string, text: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("predictions.note");
    const t = note.parse(text);
    const p = await db.query.predictions.findFirst({ where: eq(predictions.id, predictionId) });
    if (!p) throw new UserError("Prediction not found.");
    const notes = [...(p.overrideNotes ?? []), { by: admin.id, name: admin.name, at: new Date().toISOString(), text: t }];
    await db.update(predictions).set({ overrideNotes: notes }).where(eq(predictions.id, predictionId));
    await audit(admin, "prediction.note_added", "prediction", predictionId, null, { text: t });
    revalidatePath("/admin/predictions");
  }, "Note saved.");
}
