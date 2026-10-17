import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/admin";

export type ActionResult<T = void> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export class UserError extends Error {}

/** Runs an action body and turns expected failures into a message the UI can show. */
export async function run<T>(fn: () => Promise<T>, success?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: success };
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof UserError) return { ok: false, error: err.message };
    if (err instanceof ZodError) return { ok: false, error: err.issues.map((i) => i.message).join(" ") };
    // Let Next.js redirects/notFound through.
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
    console.error("[action]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
