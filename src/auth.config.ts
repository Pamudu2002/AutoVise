import type { NextAuthConfig } from "next-auth";

export type AdminRole = "super_admin" | "admin" | "analyst";

/** Sessions without "keep me signed in" end after this many seconds. */
const SHORT_SESSION_SECONDS = 12 * 60 * 60;

/**
 * Edge-safe part of the Auth.js config (no database or bcrypt), shared by the middleware and
 * the full config in src/lib/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path === "/admin/login") return true;
      if (path.startsWith("/admin")) return !!auth?.user;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: AdminRole }).role ?? "analyst";
        token.remember = (user as { remember?: boolean }).remember ?? false;
        token.signedInAt = Math.floor(Date.now() / 1000);
      }
      if (!token.remember && typeof token.signedInAt === "number") {
        if (Math.floor(Date.now() / 1000) - token.signedInAt > SHORT_SESSION_SECONDS) return null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AdminRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
