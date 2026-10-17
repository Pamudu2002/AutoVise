import { asc } from "drizzle-orm";
import { UsersAdmin } from "@/components/admin/users-admin";
import { can, requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ me?: string }> }) {
  const user = await requirePageAdmin();
  const { me } = await searchParams;
  const manage = can(user.role, "users.manage");
  // Everyone can change their own password here; only super-admins see and manage the team.
  const rows = manage
    ? await db
        .select({ id: admins.id, name: admins.name, email: admins.email, role: admins.role, disabled: admins.disabled, lastLoginAt: admins.lastLoginAt, lockedUntil: admins.lockedUntil })
        .from(admins)
        .orderBy(asc(admins.name))
    : [];
  return (
    <UsersAdmin
      me={user.id}
      manage={manage}
      openPassword={me === "1"}
      rows={rows.map((r) => ({ ...r, lastLoginAt: r.lastLoginAt?.toISOString() ?? null, locked: !!r.lockedUntil && r.lockedUntil > new Date() }))}
    />
  );
}
