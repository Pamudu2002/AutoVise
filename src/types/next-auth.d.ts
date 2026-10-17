import type { DefaultSession } from "next-auth";
import type { AdminRole } from "@/auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AdminRole;
    } & DefaultSession["user"];
  }
}
