/**
 * Seeds the super-admin, sectors, sample companies (with generated sample report PDFs, extracted
 * figures, insights, price history and events), past predictions for the track record, current
 * predictions computed by the real valuation engine, sample chat feedback and a demo customer-evidence
 * study (fictional operators) whose approved findings are attached to the STEL pitch.
 *
 *   npm run db:seed              # first run
 *   npm run db:seed -- --reset   # wipe all data and seed again
 *   npm run db:seed -- --with-ai # also call Gemini for factor scores, pitches and embeddings
 *
 * Runs with the react-server condition so server-only modules load outside Next.js.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const args = new Set(process.argv.slice(2));
if (!args.has("--with-ai")) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const DAY = 86_400_000;
const today = new Date(Math.floor(Date.now() / DAY) * DAY);
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const { randomBytes } = await import("node:crypto");
  const bcrypt = (await import("bcryptjs")).default;
  const { sql, eq, and } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const s = await import("@/lib/db/schema");
  const { putFile } = await import("@/lib/blob");
  const { chunkPages } = await import("@/lib/pipeline/chunk");
  const { embedDocuments } = await import("@/lib/pipeline/embed");
  const { DEFAULT_SETTINGS } = await import("@/lib/settings");
  const { recomputeCompany } = await import("@/lib/predictions/recompute");
  const { publishPrediction } = await import("@/lib/predictions/publish");
  const { valueCompany, buildHistory, heuristicFactorScores } = await import("@/lib/valuation");
  const { makeReportPdf } = await import("./sample-pdf");
  const { SECTORS, COMPANIES, CHAT_SAMPLES } = await import("./seed-data");
  type SeedCompany = (typeof COMPANIES)[number];
  type SeedYear = SeedCompany["years"][number];

  const existing = await db.select({ id: s.companies.id }).from(s.companies).limit(1);
  if (existing.length && !args.has("--reset")) {
    console.log("The database already has companies. Run with --reset to wipe and seed again.");
    return;
  }
  if (args.has("--reset")) {
    console.log("Resetting data…");
    await db.execute(
      sql`TRUNCATE chat_messages, chat_sessions, predictions, report_chunks, qualitative_insights, financial_metrics, report_versions, financial_reports, company_events, price_history, companies, sectors, audit_logs, rate_limits, settings RESTART IDENTITY CASCADE`,
    );
  }

  // ── Settings and admins ──────────────────────────────────────────────
  await db.insert(s.settings).values({ id: 1, data: DEFAULT_SETTINGS }).onConflictDoNothing();

  const email = (process.env.SEED_ADMIN_EMAIL || "admin@autovise.local").toLowerCase();
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(password, 12);
  const [superAdmin] = await db
    .insert(s.admins)
    .values({ email, name: process.env.SEED_ADMIN_NAME || "Super Admin", passwordHash: hash, role: "super_admin" })
    .onConflictDoUpdate({ target: s.admins.email, set: { passwordHash: hash, role: "super_admin", disabled: false, failedAttempts: 0, lockedUntil: null } })
    .returning();
  const staff = async (mail: string, name: string, role: "admin" | "analyst") => {
    const [row] = await db
      .insert(s.admins)
      .values({ email: mail, name, role, passwordHash: await bcrypt.hash(randomBytes(18).toString("base64url"), 10) })
      .onConflictDoUpdate({ target: s.admins.email, set: { name } })
      .returning();
    return row;
  };
  const analyst = await staff("nimal.perera@autovise.local", "Nimal Perera", "analyst");
  const reviewer = await staff("anusha.silva@autovise.local", "Anusha Silva", "admin");

  // ── Sectors ──────────────────────────────────────────────────────────
  const sectorRows = await db
    .insert(s.sectors)
    .values(SECTORS.map((x) => ({ name: x.name, benchmarkPe: x.pe, benchmarkGrowth: x.growth, benchmarkRoe: x.roe, notes: x.notes, dcfApplicable: x.dcf ?? true })))
    .returning();
  const sectorId = new Map(sectorRows.map((r) => [r.name, r.id]));

  // ── Helpers ──────────────────────────────────────────────────────────
  const statements = (y: SeedYear, sharesMn: number, bank: boolean) => {
    const netIncome = Math.round(y.eps * sharesMn);
    const revenue = Math.round(y.revenue ?? netIncome / y.netMargin);
    const equity = Math.round(Math.abs(netIncome / y.roe));
    const debt = y.de === null ? null : Math.round(equity * y.de);
    const liabilities = Math.round(bank ? equity * 9 : (debt ?? 0) + equity * 0.4);
    const assets = equity + liabilities;
    const ocf = Math.round(netIncome > 0 ? netIncome * 1.35 : revenue * 0.03);
    return {
      revenue,
      grossProfit: Math.round(revenue * (bank ? 0.62 : 0.38)),
      operatingIncome: Math.round(revenue * (y.netMargin + 0.05)),
      netIncome,
      eps: y.eps,
      dps: y.dps || null,
      totalAssets: assets,
      totalLiabilities: liabilities,
      totalEquity: equity,
      currentAssets: bank ? null : Math.round(assets * 0.3),
      currentLiabilities: bank ? null : Math.round(liabilities * 0.35),
      totalDebt: debt,
      cash: Math.round(assets * 0.06),
      operatingCashFlow: ocf,
      capex: bank ? Math.round(ocf * 0.1) : Math.round(ocf * 0.45),
      sharesOutstanding: Math.round(sharesMn * 1e6),
    };
  };

  const FILLER = {
    2: "The Board thanks shareholders, customers and employees for their continued support during the year.",
    3: "Operating performance across the Group's businesses is discussed in the segment review that follows.",
    4: "The Board, through its Audit and Risk Committees, reviews principal risks and the controls that address them each quarter.",
  } as Record<number, string>;

  /** Price history: weekly closes interpolated through anchor points with gentle noise, exact at anchors. */
  const priceSeries = (c: SeedCompany) => {
    const last = daysAgo(c.priceDaysAgo);
    const first = new Date(last.getTime() - 5 * 365 * DAY);
    const e0 = c.years[0].eps > 0 ? c.years[0].eps : c.years[1].eps * 0.6;
    const anchors: [number, number][] = [
      [first.getTime(), c.price * (e0 / c.years[c.years.length - 1].eps) * 0.95],
      ...c.track.flatMap((t) => {
        const made = new Date(t.made + "T00:00:00Z");
        const later = new Date(made);
        later.setUTCFullYear(later.getUTCFullYear() + 1);
        return [[made.getTime(), t.start], [later.getTime(), t.actual]] as [number, number][];
      }),
      [last.getTime(), c.price],
    ];
    anchors.sort((a, b) => a[0] - b[0]);
    const times = new Set<number>(anchors.map((a) => a[0]));
    for (let t = last.getTime(); t >= first.getTime(); t -= 7 * DAY) times.add(t);
    const seed = c.ticker.charCodeAt(0) / 10;
    return [...times]
      .sort((a, b) => a - b)
      .map((t, i) => {
        const k = anchors.findIndex((a) => a[0] >= t);
        const [t1, p1] = anchors[Math.max(0, k)];
        const [t0, p0] = anchors[Math.max(0, k - 1)];
        const f = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
        const base = Math.exp(Math.log(p0) + (Math.log(p1) - Math.log(p0)) * f);
        const near = Math.min(...anchors.map((a) => Math.abs(a[0] - t))) / (21 * DAY);
        const noise = (0.04 * Math.sin(i * 0.21 + seed) + 0.018 * Math.sin(i * 0.67 + seed * 1.7) + 0.006 * Math.sin(i * 2.3 + seed * 0.3)) * Math.min(1, near);
        return { date: isoDate(new Date(t)), price: Math.round(base * (1 + noise) * 100) / 100 };
      });
  };

  const companyIds = new Map<string, string>();
  const laterApprovals: { companyId: string; versionId: string; title: string }[] = [];
  let reportCount = 0;

  // ── Companies, prices, reports ───────────────────────────────────────
  for (const c of COMPANIES) {
    const bank = c.sector === "Banking";
    const [co] = await db
      .insert(s.companies)
      .values({
        slug: c.ticker.toLowerCase(),
        name: c.name,
        ticker: c.ticker,
        sectorId: sectorId.get(c.sector),
        logoUrl: c.logo,
        logoDarkUrl: c.logoDark,
        logoBg: c.logoBg,
        logoShape: c.logoShape,
        brandColor: c.color,
        description: c.description,
        website: c.website,
        currency: "LKR",
        sharesOutstanding: Math.round(c.sharesMn * 1e6),
        currentPrice: c.price,
        priceUpdatedAt: new Date(daysAgo(c.priceDaysAgo).getTime() + 9 * 3600_000),
        status: c.status,
      })
      .returning();
    companyIds.set(c.ticker, co.id);

    const series = priceSeries(c);
    for (let i = 0; i < series.length; i += 200) {
      await db.insert(s.priceHistory).values(series.slice(i, i + 200).map((p) => ({ companyId: co.id, date: p.date, price: p.price, source: "seed" })));
    }

    for (const r of c.reports) {
      const insights = c.insights.filter((i) => i.report === r.key);
      const fileName = r.status === "failed" ? `${c.ticker}_Annual_Report_2025_v2.pdf` : `${c.ticker}_${r.title.replace(/[^\w]+/g, "_")}.pdf`;
      const narrative = (page: number, title: string, subtitle?: string) => ({
        title,
        subtitle,
        blocks: [...insights.filter((i) => i.page === page).map((i) => ({ kind: "para" as const, text: i.quote })), { kind: "para" as const, text: FILLER[page] ?? FILLER[3] }],
      });
      const yearRows = (r.years ?? []).map((y) => c.years.find((x) => x.year === y)).filter((x): x is SeedYear => !!x);
      const st = yearRows.map((y) => ({ year: y.year, ...statements(y, c.sharesMn, bank) }));

      let pages;
      let metricRows: { fiscalYear: number; period: string; values: Record<string, number | null>; pages: Record<string, number> }[] = [];
      if (r.quarter) {
        const q = r.quarter;
        const prior = { revenue: Math.round(q.revenue / 1.12), netIncome: Math.round(q.netIncome / 1.1), eps: Math.round((q.eps / 1.1) * 100) / 100 };
        pages = [
          narrative(2, "Highlights of the quarter", `For the quarter ended ${r.periodEnd}`),
          narrative(3, "Outlook and principal risks"),
          {
            title: "Statement of profit or loss",
            subtitle: "For the quarter ended 30 June 2026 · unaudited",
            blocks: [{ kind: "table" as const, header: ["LKR million", "Q2 2026", "Q2 2025"], rows: [["Revenue", q.revenue, prior.revenue], ["Profit attributable to shareholders", q.netIncome, prior.netIncome], ["Basic EPS (LKR)", q.eps, prior.eps]] }],
          },
          {
            title: "Statement of financial position",
            subtitle: "As at 30 June 2026 · unaudited",
            blocks: [{ kind: "table" as const, header: ["LKR million", "30 Jun 2026", ""], rows: [["Total equity", q.equity, null], ["Interest-bearing borrowings", q.debt, null]] }],
          },
        ];
        metricRows = [
          {
            fiscalYear: q.year,
            period: q.period,
            values: { revenue: q.revenue, netIncome: q.netIncome, eps: q.eps, totalEquity: q.equity, totalDebt: q.debt },
            pages: { revenue: 4, netIncome: 4, eps: 4, totalEquity: 5, totalDebt: 5 },
          },
        ];
      } else {
        const [cur, prev] = st;
        const pair = (k: keyof (typeof st)[number]) => [cur?.[k] ?? null, prev?.[k] ?? null] as (number | null)[];
        const head = ["LKR million", `FY${cur?.year ?? r.fiscalYear}`, prev ? `FY${prev.year}` : ""];
        pages = [
          narrative(2, "Chairman's statement"),
          narrative(3, "Operating review and outlook"),
          narrative(4, "Risk management and governance"),
          {
            title: "Statement of profit or loss",
            subtitle: `For the year ended ${r.periodEnd}`,
            blocks: [
              {
                kind: "table" as const,
                header: head,
                rows: [
                  [bank ? "Total operating income" : "Revenue", ...pair("revenue")],
                  ["Gross profit", ...pair("grossProfit")],
                  ["Operating profit", ...pair("operatingIncome")],
                  ["Profit attributable to shareholders", ...pair("netIncome")],
                  ["Basic EPS (LKR)", ...pair("eps")],
                  ["Dividend per share (LKR)", ...pair("dps")],
                ],
              },
            ],
          },
          {
            title: "Statement of financial position",
            subtitle: `As at ${r.periodEnd}`,
            blocks: [
              {
                kind: "table" as const,
                header: head,
                rows: [
                  ["Total assets", ...pair("totalAssets")],
                  ["Current assets", ...pair("currentAssets")],
                  ["Total liabilities", ...pair("totalLiabilities")],
                  ["Current liabilities", ...pair("currentLiabilities")],
                  ["Interest-bearing borrowings", ...pair("totalDebt")],
                  ["Cash and cash equivalents", ...pair("cash")],
                  ["Total equity", ...pair("totalEquity")],
                ],
              },
            ],
          },
          {
            title: "Statement of cash flows",
            subtitle: `For the year ended ${r.periodEnd}`,
            blocks: [{ kind: "table" as const, header: head, rows: [["Net cash from operating activities", ...pair("operatingCashFlow")], ["Purchase of property, plant and equipment", ...pair("capex")]] }],
          },
        ];
        const pg = { revenue: 5, grossProfit: 5, operatingIncome: 5, netIncome: 5, eps: 5, dps: 5, totalAssets: 6, currentAssets: 6, totalLiabilities: 6, currentLiabilities: 6, totalDebt: 6, cash: 6, totalEquity: 6, operatingCashFlow: 7, capex: 7 };
        metricRows = st.map((x) => {
          const { year, ...values } = x;
          return { fiscalYear: year, period: "FY", values, pages: pg };
        });
      }

      const pdf = await makeReportPdf({ company: c.name, title: r.title, period: r.fiscalPeriod, pages });
      const stored = await putFile(`reports/${co.id}/${fileName}`, pdf, "application/pdf");
      const [rep] = await db
        .insert(s.financialReports)
        .values({ companyId: co.id, title: r.title, type: r.type, fiscalYear: r.fiscalYear, fiscalPeriod: r.fiscalPeriod, periodEnd: r.periodEnd, createdAt: daysAgo(r.uploadedDaysAgo) })
        .returning();
      let versionNo = 1;
      if (r.previousVersion) {
        const old = await putFile(`reports/${co.id}/${r.previousVersion.fileName}`, pdf, "application/pdf");
        await db.insert(s.reportVersions).values({
          reportId: rep.id,
          versionNo: 1,
          blobUrl: old.url,
          fileName: r.previousVersion.fileName,
          mime: "application/pdf",
          size: pdf.length,
          pageCount: pages.length + 1,
          status: "superseded",
          progress: 100,
          note: r.previousVersion.note,
          uploadedBy: reviewer.id,
          createdAt: daysAgo(r.previousVersion.uploadedDaysAgo),
          processedAt: daysAgo(r.previousVersion.uploadedDaysAgo),
        });
        versionNo = 2;
      }
      const approved = r.status === "approved";
      const [ver] = await db
        .insert(s.reportVersions)
        .values({
          reportId: rep.id,
          versionNo,
          blobUrl: stored.url,
          fileName,
          mime: "application/pdf",
          size: pdf.length,
          pageCount: pages.length + 1,
          status: r.status,
          progress: r.status === "failed" ? 0 : 100,
          error: r.error ?? null,
          note: r.note ?? null,
          uploadedBy: r.uploadedDaysAgo < 3 ? analyst.id : reviewer.id,
          approvedBy: approved ? reviewer.id : null,
          approvedAt: approved ? daysAgo(Math.max(0, r.uploadedDaysAgo - 2)) : null,
          processedAt: r.status === "failed" ? null : daysAgo(r.uploadedDaysAgo),
          createdAt: new Date(daysAgo(r.uploadedDaysAgo).getTime() + 10 * 3600_000 - (r.uploadedDaysAgo === 0 ? 11 * 3600_000 : 0)),
        })
        .returning();
      await db.update(s.financialReports).set({ currentVersionId: ver.id }).where(eq(s.financialReports.id, rep.id));
      reportCount++;
      if (r.status === "failed") continue;
      if (r.approveLater) laterApprovals.push({ companyId: co.id, versionId: ver.id, title: r.title });

      for (const m of metricRows) {
        const confidence = Object.fromEntries(Object.keys(m.values).map((k) => [k, k === "totalDebt" ? 71 : 96 + (k.length % 4)]));
        await db.insert(s.financialMetrics).values({
          reportVersionId: ver.id,
          companyId: co.id,
          fiscalYear: m.fiscalYear,
          period: m.period,
          unitMultiplier: 1_000_000,
          ...m.values,
          sourcePages: m.pages,
          extra: { confidence },
          verified: approved,
        });
      }
      if (insights.length) {
        await db.insert(s.qualitativeInsights).values(
          insights.map((i) => ({ reportVersionId: ver.id, companyId: co.id, category: i.category, summary: i.summary, sentiment: i.sentiment, impact: i.impact, evidenceQuote: i.quote, page: i.page })),
        );
      }
      const pageTexts = pages.map((p, k) => ({
        page: k + 2,
        text: [p.title, p.subtitle ?? "", ...p.blocks.map((b) => (b.kind === "para" ? b.text : [b.header.join(" | "), ...b.rows.map((row) => row.join(" | "))].join("\n")))].join("\n\n"),
      }));
      const chunks = chunkPages(pageTexts);
      const vectors = await embedDocuments(chunks.map((x) => x.content));
      if (chunks.length) {
        await db.insert(s.reportChunks).values(chunks.map((ch, k) => ({ reportVersionId: ver.id, companyId: co.id, page: ch.page, chunkIndex: ch.index, content: ch.content, embedding: vectors[k] })));
      }
    }

    for (const e of c.events) {
      await db.insert(s.companyEvents).values({ companyId: co.id, date: isoDate(daysAgo(e.daysAgo)), title: e.title, body: e.body, sentiment: e.sentiment, createdBy: analyst.id });
    }
  }

  // ── Past predictions for the track record ────────────────────────────
  let version = new Map<string, number>();
  const sectorBy = new Map(SECTORS.map((x) => [x.name, x]));
  for (const c of COMPANIES) {
    const companyId = companyIds.get(c.ticker)!;
    for (const t of c.track) {
      const made = new Date(t.made + "T00:00:00Z");
      const cutoff = made.getUTCFullYear() - 1;
      const history = c.years
        .filter((y) => y.year <= cutoff)
        .map((y) => ({ fiscalYear: y.year, period: "FY", unitMultiplier: 1_000_000, ...statements(y, c.sharesMn, c.sector === "Banking"), periodEnd: `${y.year}-12-31` }));
      const built = buildHistory(history);
      const sec = sectorBy.get(c.sector)!;
      const factors = heuristicFactorScores([], []);
      const out = valueCompany({
        price: t.start,
        priceDate: t.made,
        history: built.history,
        latestBalance: built.latestBalance,
        latestPeriodEnd: built.latestPeriodEnd,
        sharesOutstanding: c.sharesMn * 1e6,
        sector: { name: sec.name, pe: sec.pe, growth: sec.growth, roe: sec.roe, dcf: sec.dcf ?? true },
        factorScores: factors,
        asOf: made,
        settings: DEFAULT_SETTINGS.valuation,
      });
      if (!out.ok) continue;
      const v = (version.get(companyId) ?? 0) + 1;
      version.set(companyId, v);
      await db.insert(s.predictions).values({
        companyId,
        version: v,
        status: "archived",
        basePrice: t.start,
        currency: "LKR",
        scenarios: out.result.scenarios,
        upsidePct: out.result.upsidePct,
        confidence: out.result.confidence,
        autoviseScore: out.result.autoviseScore,
        assumptions: out.result.assumptions,
        factorScores: factors,
        valuationBreakdown: out.result.waterfall,
        pitch: null,
        citations: [],
        basedOn: [],
        inputsHash: `seed-${c.ticker}-${t.made}`,
        modelVersion: "engine-1 · deterministic",
        trigger: "Historical prediction (seed)",
        createdAt: made,
        publishedAt: made,
        publishedBy: reviewer.id,
      });
    }
  }
  version = new Map();

  // ── Current predictions (real engine), published ─────────────────────
  for (const c of COMPANIES) {
    const id = companyIds.get(c.ticker)!;
    const res = await recomputeCompany(id, { trigger: "Initial data load", force: true });
    if (res.status === "created") {
      await publishPrediction(res.predictionId, reviewer.id);
      console.log(`  ${c.ticker.padEnd(5)} prediction v${res.version} published`);
    } else {
      console.log(`  ${c.ticker.padEnd(5)} no prediction (${res.status === "insufficient" ? res.reason : res.status})`);
    }
  }

  // ── New interim reports approved → drafts awaiting review ───────────
  for (const a of laterApprovals) {
    await db.update(s.reportVersions).set({ status: "approved", approvedBy: analyst.id, approvedAt: new Date() }).where(eq(s.reportVersions.id, a.versionId));
    await db.update(s.financialMetrics).set({ verified: true }).where(eq(s.financialMetrics.reportVersionId, a.versionId));
    const res = await recomputeCompany(a.companyId, { trigger: `${a.title} approved` });
    if (res.status === "created") console.log(`  draft v${res.version} created after ${a.title}`);
  }

  await db
    .update(s.predictions)
    .set({ overrideNotes: [{ by: reviewer.id, name: reviewer.name, at: daysAgo(38).toISOString(), text: "Held the exit P/E near the model's figure until the concession renewal terms are clearer." }] })
    .where(and(eq(s.predictions.companyId, companyIds.get("LHL")!), eq(s.predictions.status, "published")));

  // ── Chat samples ─────────────────────────────────────────────────────
  for (const [k, q] of CHAT_SAMPLES.entries()) {
    const companyId = companyIds.get(q.ticker)!;
    const at = new Date(Date.now() - q.hoursAgo * 3600_000);
    const [session] = await db.insert(s.chatSessions).values({ anonId: `seed-visitor-${k}`, companyId, createdAt: at, lastActiveAt: at }).returning();
    await db.insert(s.chatMessages).values({ sessionId: session.id, companyId, role: "user", content: q.q, createdAt: at });
    await db.insert(s.chatMessages).values({
      sessionId: session.id,
      companyId,
      role: "assistant",
      content: q.a,
      citations: [],
      feedback: q.vote || null,
      feedbackReason: q.reason ?? null,
      feedbackNote: q.note ?? null,
      createdAt: new Date(at.getTime() + 4000),
    });
  }

  // ── Customer evidence (docs/PLAN2.md): a demo study with fictional operators ──
  const { seedEvidence } = await import("./seed-evidence");
  const ev = await seedEvidence({ companyId: companyIds.get("STEL")!, coderId: analyst.id, checkerId: reviewer.id, collectionDate: isoDate(daysAgo(10)) });
  console.log(`  STEL  customer-evidence study: ${ev.records} records, ${ev.findings} approved findings, ${ev.pitchesUpdated} pitch(es) updated`);

  await db.insert(s.auditLogs).values({ actorId: superAdmin.id, actorEmail: superAdmin.email, action: "seed.completed", entity: "system", entityId: null, after: { companies: COMPANIES.length, reports: reportCount } });

  console.log(`\nSeeded ${COMPANIES.length} companies, ${SECTORS.length} sectors and ${reportCount} reports.`);
  console.log(`Super-admin: ${email}`);
  if (generated) console.log(`Generated password (shown once — change it after signing in): ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
