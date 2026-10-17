import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { admins, auditLogs } from "@/lib/db/schema";

export const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

let dummy: string | null = null;
const dummyHash = () => (dummy ??= bcrypt.hashSync("timing-equaliser", 12));

class InvalidLogin extends CredentialsSignin {
  code = "invalid";
}
class LockedLogin extends CredentialsSignin {
  code = "locked";
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  remember: z.enum(["on", "true", "false", ""]).optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, remember: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();
        const { email, password, remember } = parsed.data;

        const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
        if (!admin || admin.disabled) {
          // Spend the same time as a real check so emails cannot be enumerated by timing.
          await bcrypt.compare(password, dummyHash());
          throw new InvalidLogin();
        }
        if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new LockedLogin();

        const ok = await bcrypt.compare(password, admin.passwordHash);
        if (!ok) {
          const attempts = admin.failedAttempts + 1;
          const lock = attempts >= MAX_ATTEMPTS;
          await db
            .update(admins)
            .set({
              failedAttempts: lock ? 0 : attempts,
              lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            })
            .where(eq(admins.id, admin.id));
          if (lock) {
            await db.insert(auditLogs).values({ actorId: admin.id, actorEmail: admin.email, action: "auth.locked", entity: "admin", entityId: admin.id });
            throw new LockedLogin();
          }
          const err = new InvalidLogin();
          err.code = `invalid:${MAX_ATTEMPTS - attempts}`;
          throw err;
        }

        await db.update(admins).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
        await db.insert(auditLogs).values({ actorId: admin.id, actorEmail: admin.email, action: "auth.sign_in", entity: "admin", entityId: admin.id });
        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          remember: remember === "on" || remember === "true",
        };
      },
    }),
  ],
});
