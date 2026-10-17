"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { run, UserError, type ActionResult } from "./result";

const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200)
  .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), "Use letters and at least one number.");

const newUser = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  role: z.enum(["super_admin", "admin", "analyst"]),
  password,
});

export async function createUser(input: z.input<typeof newUser>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("users.manage");
    const d = newUser.parse(input);
    const exists = await db.query.admins.findFirst({ where: eq(admins.email, d.email) });
    if (exists) throw new UserError("A user with that email already exists.");
    const [row] = await db.insert(admins).values({ name: d.name, email: d.email, role: d.role, passwordHash: await bcrypt.hash(d.password, 12) }).returning({ id: admins.id });
    await audit(admin, "user.created", "admin", row.id, null, { name: d.name, email: d.email, role: d.role });
    revalidatePath("/admin/users");
  }, "User created.");
}

const update = z.object({ id: z.string().uuid(), role: z.enum(["super_admin", "admin", "analyst"]), disabled: z.boolean() });

export async function updateUser(input: z.input<typeof update>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("users.manage");
    const d = update.parse(input);
    if (d.id === admin.id && (d.disabled || d.role !== "super_admin")) throw new UserError("You can't demote or disable your own account.");
    const before = await db.query.admins.findFirst({ where: eq(admins.id, d.id) });
    if (!before) throw new UserError("User not found.");
    if (before.role === "super_admin" && (d.role !== "super_admin" || d.disabled)) {
      const [{ n }] = await db.select({ n: count() }).from(admins).where(and(eq(admins.role, "super_admin"), eq(admins.disabled, false), ne(admins.id, d.id)));
      if (n === 0) throw new UserError("There must always be at least one active super-admin.");
    }
    await db.update(admins).set({ role: d.role, disabled: d.disabled, updatedAt: new Date() }).where(eq(admins.id, d.id));
    await audit(admin, "user.updated", "admin", d.id, { role: before.role, disabled: before.disabled }, { role: d.role, disabled: d.disabled });
    revalidatePath("/admin/users");
  }, "User updated.");
}

export async function resetPassword(id: string, newPassword: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("users.manage");
    const p = password.parse(newPassword);
    await db.update(admins).set({ passwordHash: await bcrypt.hash(p, 12), failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(admins.id, id));
    await audit(admin, "user.password_reset", "admin", id);
  }, "Password reset. Share it with the user securely.");
}

export async function changeOwnPassword(current: string, next: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    const p = password.parse(next);
    const row = await db.query.admins.findFirst({ where: eq(admins.id, admin.id) });
    if (!row || !(await bcrypt.compare(current, row.passwordHash))) throw new UserError("Your current password is not correct.");
    await db.update(admins).set({ passwordHash: await bcrypt.hash(p, 12), updatedAt: new Date() }).where(eq(admins.id, admin.id));
    await audit(admin, "user.password_changed", "admin", admin.id);
  }, "Password changed.");
}
