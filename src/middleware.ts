import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/** Protects /admin (except the login page). Pages and actions also check the role themselves. */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*"],
};
