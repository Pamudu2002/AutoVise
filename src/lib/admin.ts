import "server-only";
import { redirect } from "next/navigation";
import type { AdminRole } from "@/auth.config";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

const ALL: AdminRole[] = ["super_admin", "admin", "analyst"];
const ADMINS: AdminRole[] = ["super_admin", "admin"];

/** What each role may do. Analysts prepare data; admins publish and configure; super-admins manage users. */
export const PERMISSIONS = {
  "reports.write": ALL,
  "reports.review": ALL,
  "prices.write": ALL,
  "events.write": ALL,
  "predictions.rerun": ALL,
  "predictions.note": ALL,
  "chat.review": ALL,
  "predictions.publish": ADMINS,
  "companies.write": ADMINS,
  "sectors.write": ADMINS,
  "settings.write": ADMINS,
  "audit.view": ADMINS,
  "users.manage": ["super_admin"] as AdminRole[],
} as const;
export type Permission = keyof typeof PERMISSIONS;

export const can = (role: AdminRole | undefined, p: Permission) => !!role && (PERMISSIONS[p] as readonly AdminRole[]).includes(role);

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
  }
}

async function current(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? session.user.email ?? "Admin",
    role: session.user.role,
  };
}

/** For pages: redirect to login when signed out; to the dashboard when the role is not enough. */
export async function requirePageAdmin(p?: Permission): Promise<AdminUser> {
  const user = await current();
  if (!user) redirect("/admin/login");
  if (p && !can(user.role, p)) redirect("/admin?denied=1");
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireAdmin(p?: Permission): Promise<AdminUser> {
  const user = await current();
  if (!user) throw new ForbiddenError("Your session has ended. Sign in again.");
  if (p && !can(user.role, p)) throw new ForbiddenError();
  return user;
}

export async function audit(
  actor: AdminUser | null,
  action: string,
  entity: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
) {
  await db.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? "system",
    action,
    entity,
    entityId,
    before: before === undefined ? null : (JSON.parse(JSON.stringify(before)) as object),
    after: after === undefined ? null : (JSON.parse(JSON.stringify(after)) as object),
  });
}

export const roleLabel: Record<AdminRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  analyst: "Analyst",
};
