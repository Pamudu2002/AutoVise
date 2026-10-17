import { and, eq } from "drizzle-orm";
import { AlertTriangle, ChevronRight, Clock, Download, ExternalLink, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/chat-panel";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyTabs } from "@/components/company-tabs";
import { PriceProjectionChart } from "@/components/price-projection-chart";
import { Disclaimer, ScoreGauge, UpsideBadge, meterClass } from "@/components/ui/figures";
import { auth } from "@/lib/auth";
import { getCompanyPage, getCompanyPageUncached, type CompanyPageData } from "@/lib/data/public";
import { db } from "@/lib/db";
import { predictions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { fmtDate, fmtDateTime, fmtMonthYear, money, signedPct } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { confidenceLabel } from "@/lib/valuation/confidence";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCompanyPage(slug);
  // Called before streaming starts, so unknown companies get a real 404 status.
  if (!data) notFound();
  if (data.company.status !== "published") return { title: data.company.name, robots: { index: false } };
  const p = data.prediction;
  const desc = p
    ? `${data.company.name} (${data.company.ticker}): 3-year base target ${money(p.scenarios.base.y3, data.company.currency)} (${signedPct(p.upsidePct)}), with the full pitch, assumptions and sources.`
    : `${data.company.name} (${data.company.ticker}): research and figures from its financial reports.`;
  return {
    title: `${data.company.name} (${data.company.ticker})`,
    description: desc,
    openGraph: { title: `${data.company.name} — AutoVise pitch`, description: desc, type: "article" },
    twitter: { card: "summary_large_image", title: `${data.company.name} — AutoVise pitch`, description: desc },
  };
}

export default async function CompanyPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ preview?: string }> }) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const session = await auth();
  const isAdmin = !!session?.user;

  let data: CompanyPageData | null = isAdmin ? await getCompanyPageUncached(slug) : await getCompanyPage(slug);
  if (!data) notFound();
  if (data.company.status !== "published" && !isAdmin) notFound();

  // Admins can preview a draft prediction before publishing it.
  let previewing: number | null = null;
  if (isAdmin && preview && /^[0-9a-f-]{36}$/.test(preview)) {
    const draft = await db.query.predictions.findFirst({ where: and(eq(predictions.id, preview), eq(predictions.companyId, data.company.id)) });
    if (draft) {
      previewing = draft.version;
      data = { ...data, prediction: { ...draft, createdAt: draft.createdAt.toISOString(), publishedAt: draft.publishedAt?.toISOString() ?? null }, pendingNote: null };
    }
  }

  const settings = await getSettings();
  const co = data.company;
  const p = data.prediction;
  const cur = co.currency;
  const upside = p && co.price ? p.scenarios.base.y3 / co.price - 1 : null;

  return (
    <div className="page-pad-sheet">
      {(previewing !== null || co.status !== "published") && (
        <div style={{ background: "var(--warn-soft)", color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
          <div className="wrap" style={{ padding: "10px 32px", display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <Eye size={16} aria-hidden />
            {previewing !== null ? `Admin preview of prediction v${previewing} — visitors see the published version.` : "This company is a draft — only admins can see this page."}
            <Link href="/admin/predictions" style={{ marginLeft: "auto" }}>
              Back to admin
            </Link>
          </div>
        </div>
      )}

      <section style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="wrap" style={{ paddingTop: 20, paddingBottom: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--muted)" }}>
            <Link href="/" style={{ color: "var(--muted)" }}>
              Companies
            </Link>
            <ChevronRight size={14} aria-hidden />
            <span aria-current="page" style={{ color: "var(--text)" }}>
              {co.name}
            </span>
          </nav>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div className="hero-id" style={{ display: "flex", gap: 20, alignItems: "center", flex: "1 1 440px", minWidth: 0 }}>
              <CompanyLogo {...co} size={96} hero />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <h1 style={{ fontSize: 30, lineHeight: 1.15, fontWeight: 600 }}>{co.name}</h1>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="chip num" style={{ color: "var(--text)" }}>
                    {co.ticker}
                  </span>
                  <span className="chip">{co.sector}</span>
                  {co.website && (
                    <a href={co.website} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500 }}>
                      Company website
                      <ExternalLink size={13} aria-hidden />
                    </a>
                  )}
                </div>
                {co.description && <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 560 }}>{co.description}</p>}
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  {data.latestReportDate ? `Last updated from reports dated ${fmtDate(data.latestReportDate)}` : "No approved reports yet"}
                </span>
                {data.outdatedLabel && (
                  <span className="warn-chip" style={{ alignSelf: "flex-start" }}>
                    <AlertTriangle size={13} aria-hidden />
                    {data.outdatedLabel}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Current price</span>
                <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                  {money(co.price, cur)}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDateTime(co.priceUpdatedAt)}</span>
              </div>
              {p && upside !== null ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>3-yr target · base</span>
                    <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                      {money(p.scenarios.base.y3, cur)}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>By {fmtMonthYear(p.assumptions.horizonDate)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Upside</span>
                    <UpsideBadge value={upside} large />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 150 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Confidence</span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div className={meterClass(p.confidence)} style={{ flex: 1 }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.confidence} aria-label={`Confidence ${p.confidence} of 100`}>
                        <span style={{ width: `${p.confidence}%` }} />
                      </div>
                      <span className="num" style={{ fontWeight: 600 }}>
                        {p.confidence}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{confidenceLabel(p.confidence)}</span>
                  </div>
                  <ScoreGauge value={p.autoviseScore} />
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px", borderRadius: 10, background: "var(--subtle)", maxWidth: 320 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <Clock size={14} aria-hidden />
                    Prediction pending
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{data.pendingNote}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 64, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "999 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <section className="card" style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 16 }} aria-labelledby="chart-h">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <h2 id="chart-h" style={{ fontSize: 16, fontWeight: 600 }}>
                {p ? "Price history and 3-year projection" : "Price history"}
              </h2>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 16, height: 2, background: "var(--c1)" }} />
                  History
                </span>
                {p && (
                  <>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 16, height: 0, borderTop: "2px dashed var(--c2)" }} />
                      Base case
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 14, height: 10, borderRadius: 2, background: "var(--band)" }} />
                      Bear–bull range
                    </span>
                  </>
                )}
              </div>
            </div>
            <PriceProjectionChart
              prices={data.prices}
              currency={cur}
              scenarios={p?.scenarios ?? null}
              start={p ? { date: (p.assumptions.priceDate ?? p.createdAt).slice(0, 10), price: p.basePrice } : null}
            />
            {p && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 12 }}>
                {(["bear", "base", "bull"] as const).map((k) => {
                  const v = p.scenarios[k].y3;
                  return (
                    <div key={k} style={{ padding: "12px 14px", borderRadius: 10, background: k === "base" ? "var(--accent-soft)" : "var(--subtle)", display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {k[0].toUpperCase() + k.slice(1)} case · {fmtMonthYear(p.assumptions.horizonDate)}
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="num" style={{ fontSize: 17, fontWeight: 600 }}>
                          {money(v, cur)}
                        </span>
                        {co.price ? <UpsideBadge value={v / co.price - 1} label={`${k} case versus today`} /> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Disclaimer text={settings.disclaimer.short} />
              {p && previewing === null && (
                <a className="btn btn-ghost btn-sm" href={`/api/companies/${co.slug}/pitch.pdf`} download>
                  <Download size={14} aria-hidden />
                  Download pitch (PDF)
                </a>
              )}
            </div>
          </section>

          <CompanyTabs data={data} disclaimer={settings.disclaimer.short} />
        </div>

        <ChatPanel
          company={co}
          hasPrediction={!!p}
          upside={upside}
          enabled={env.hasGemini && previewing === null}
          knownSources={(p?.citations ?? []).map((c) => ({ id: c.id, label: c.label, page: c.page, quote: c.quote, section: c.section ?? null, url: data.reports.find((r) => r.versionId === c.reportVersionId)?.url ?? null }))}
        />
      </div>
    </div>
  );
}
