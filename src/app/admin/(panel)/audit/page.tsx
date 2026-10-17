import { and, count, desc, ilike, or, type SQL } from "drizzle-orm";
import Link from "next/link";
import { AdminMain, PageHeader } from "@/components/admin/page-header";
import { AuditRow } from "@/components/admin/audit-row";
import { requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export const metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePageAdmin("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const where: SQL | undefined = q ? or(ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.entity, `%${q}%`), ilike(auditLogs.actorEmail, `%${q}%`)) : undefined;
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(auditLogs).where(and(where)).orderBy(desc(auditLogs.createdAt)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ n: count() }).from(auditLogs).where(and(where)),
  ]);
  const pages = Math.max(1, Math.ceil(n / PAGE));
  const link = (p: number) => `/admin/audit?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <AdminMain>
      <PageHeader title="Audit Log" sub="Every sign-in and every change made in the admin panel, newest first." />
      <form style={{ display: "flex", gap: 8, maxWidth: 480 }}>
        <label htmlFor="a-q" className="sr-only">
          Filter
        </label>
        <input id="a-q" name="q" className="input" placeholder="Filter by action, entity or email" defaultValue={q} />
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>
      <div className="tbl-box">
        <table className="tbl" style={{ minWidth: 900, fontSize: 13 }}>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Entity</th>
              <th className="r">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <AuditRow key={r.id} row={{ id: r.id, at: r.createdAt.toISOString(), who: r.actorEmail ?? "system", action: r.action, entity: r.entity, entityId: r.entityId, before: r.before, after: r.after }} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                  No entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
        <span className="hint tnum">
          Page {page} of {pages} · {n} entries
        </span>
        {page > 1 && (
          <Link className="btn btn-secondary btn-sm" href={link(page - 1)}>
            Newer
          </Link>
        )}
        {page < pages && (
          <Link className="btn btn-secondary btn-sm" href={link(page + 1)}>
            Older
          </Link>
        )}
      </div>
    </AdminMain>
  );
}
