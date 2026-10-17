import { AlertTriangle, Upload } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminMain, Kpi, PageHeader } from "@/components/admin/page-header";
import { QueueList } from "@/components/admin/queue-list";
import { CompanyLogo } from "@/components/company-logo";
import { UpsideBadge } from "@/components/ui/figures";
import { requirePageAdmin } from "@/lib/admin";
import { dashboardStats, reportQueue } from "@/lib/data/admin";
import { fmtDate, num, timeAgo } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requirePageAdmin();
  const { denied } = await searchParams;
  const settings = await getSettings();
  const [stats, queue] = await Promise.all([dashboardStats(settings.publishing.stalePriceDays), reportQueue({ sinceDays: 7, limit: 12 })]);
  const failed = queue.filter((q) => q.status === "failed" && q.current);
  const processing = queue.some((q) => q.status === "processing" || q.status === "uploaded");
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
  const oldest = stats.drafts[0]?.p.createdAt;

  return (
    <AdminMain gap={24}>
      <AutoRefresh when={processing} />
      {denied && (
        <div role="alert" style={{ padding: "12px 14px", borderRadius: 10, background: "var(--warn-soft)", fontSize: 14 }}>
          Your role doesn&apos;t include that page. Ask a super-admin if you need access.
        </div>
      )}
      <PageHeader
        title="Dashboard"
        sub={`What needs attention today · ${today}`}
        actions={
          <Link className="btn btn-primary" href="/admin/reports">
            <Upload size={16} aria-hidden />
            Upload reports
          </Link>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))", gap: 16 }}>
        <Kpi href="/admin/companies" label="Companies" value={stats.companies.published + stats.companies.draft} note={`${stats.companies.published} published · ${stats.companies.draft} draft`} />
        <Kpi href="/admin/reports" label="Reports processing" value={stats.processing} note={`${stats.review} waiting for review`} />
        <Kpi
          href="/admin/reports"
          label="Failed jobs"
          value={stats.failed}
          danger={stats.failed > 0}
          note={stats.failed ? (failed[0] ? `${failed[0].ticker} ${failed[0].title} · retry or re-upload` : "Retry or re-upload") : "All jobs healthy"}
        />
        <Kpi href="/admin/predictions" label="Predictions awaiting review" value={stats.drafts.length} note={oldest ? `Oldest: ${timeAgo(oldest)}` : "Nothing waiting"} />
        <Kpi href="/admin/chat-insights" label="Chats today" value={stats.chatsToday} note={`${stats.downToday} answers down-voted`} />
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <section className="card" style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column" }} aria-labelledby="q-h">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--border)", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <h2 id="q-h" style={{ fontSize: 16, fontWeight: 600 }}>
                Processing queue
              </h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Uploads from the last 7 days</span>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/admin/reports">
              View all reports
            </Link>
          </div>
          <QueueList items={queue.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() }))} />
        </section>

        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <section className="card" style={{ display: "flex", flexDirection: "column" }} aria-labelledby="stale-h">
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
              <AlertTriangle size={18} style={{ color: "var(--warn-mark)" }} aria-hidden />
              <h2 id="stale-h" style={{ fontSize: 16, fontWeight: 600 }}>
                Stale prices
              </h2>
              {stats.stale.length > 0 && (
                <span className="warn-chip" style={{ marginLeft: "auto" }}>
                  {stats.stale.length}
                </span>
              )}
            </div>
            {stats.stale.length === 0 ? (
              <p style={{ padding: "20px", color: "var(--muted)", fontSize: 14 }}>Every price is up to date.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {stats.stale.map((c) => (
                  <li key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                    <CompanyLogo {...c} size={36} decorative />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</span>
                      <span className="tnum" style={{ fontSize: 12, color: "var(--warn)" }}>
                        {c.priceUpdatedAt ? `Last price ${fmtDate(c.priceUpdatedAt)} · ${c.days} trading day${c.days === 1 ? "" : "s"}` : "No price entered"}
                      </span>
                    </div>
                    <Link className="btn btn-secondary btn-sm" href={`/admin/companies?price=${c.slug}`}>
                      Update
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column" }} aria-labelledby="rev-h">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
              <h2 id="rev-h" style={{ fontSize: 16, fontWeight: 600 }}>
                Awaiting your review
              </h2>
              <Link href="/admin/predictions" style={{ fontSize: 13 }}>
                Open
              </Link>
            </div>
            {stats.drafts.length === 0 ? (
              <p style={{ padding: 20, color: "var(--muted)", fontSize: 14 }}>No drafts waiting.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {stats.drafts.map(({ p, ticker, oldBase }) => (
                  <li key={p.id}>
                    <Link href={`/admin/predictions?company=${ticker.toLowerCase()}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)", color: "var(--text)", textDecoration: "none" }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>
                          {ticker} · new draft v{p.version}
                        </span>
                        <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
                          {oldBase ? `${num(oldBase)} → ` : ""}
                          {num(p.scenarios.base.y3)}
                        </span>
                      </div>
                      {oldBase ? <UpsideBadge value={p.scenarios.base.y3 / oldBase - 1} label="Change in base target" /> : <span className="pill pill-draft">First</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminMain>
  );
}
