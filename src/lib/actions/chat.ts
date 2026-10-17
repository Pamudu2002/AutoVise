"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { run, type ActionResult } from "./result";

export async function markReviewed(messageId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("chat.review");
    await db.update(chatMessages).set({ reviewedAt: new Date(), reviewedBy: admin.id }).where(eq(chatMessages.id, messageId));
    await audit(admin, "chat.reviewed", "chat_message", messageId);
    revalidatePath("/admin/chat-insights");
  });
}
