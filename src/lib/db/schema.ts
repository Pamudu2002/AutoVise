import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type {
  Assumptions,
  BasedOnReport,
  FactorScore,
  OverrideNote,
  ScenarioSet,
  WaterfallStep,
} from "@/lib/valuation/types";
import type { Citation, Pitch } from "@/lib/ai/schemas";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ─── Enums ────────────────────────────────────────────────────────────────
export const adminRole = pgEnum("admin_role", ["super_admin", "admin", "analyst"]);
export const logoBg = pgEnum("logo_bg", ["light", "dark", "transparent"]);
export const logoShape = pgEnum("logo_shape", ["square", "round", "tall", "wide"]);
export const companyStatus = pgEnum("company_status", ["draft", "published"]);
export const reportType = pgEnum("report_type", ["annual", "quarterly", "interim", "other"]);
export const versionStatus = pgEnum("version_status", [
  "uploaded",
  "processing",
  "review",
  "approved",
  "failed",
  "superseded",
]);
export const insightCategory = pgEnum("insight_category", [
  "management",
  "strategy",
  "outlook",
  "risk",
  "governance",
  "esg",
  "market",
  "capital_allocation",
]);
export const impactLevel = pgEnum("impact_level", ["low", "med", "high"]);
export const predictionStatus = pgEnum("prediction_status", ["draft", "published", "archived"]);
export const chatRole = pgEnum("chat_role", ["user", "assistant"]);

// ─── Admins ───────────────────────────────────────────────────────────────
export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: adminRole("role").notNull().default("analyst"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  disabled: boolean("disabled").notNull().default(false),
  ...timestamps,
});

// ─── Sectors and companies ────────────────────────────────────────────────
export const sectors = pgTable("sectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  /** Sector P/E benchmark, e.g. 11.8 */
  benchmarkPe: doublePrecision("benchmark_pe").notNull(),
  /** Long-run EPS growth benchmark as a fraction, e.g. 0.084 */
  benchmarkGrowth: doublePrecision("benchmark_growth").notNull(),
  /** Return on equity benchmark as a fraction */
  benchmarkRoe: doublePrecision("benchmark_roe").notNull(),
  notes: text("notes"),
  ...timestamps,
});

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    ticker: text("ticker").notNull().unique(),
    sectorId: uuid("sector_id").references(() => sectors.id, { onDelete: "set null" }),
    logoUrl: text("logo_url"),
    logoDarkUrl: text("logo_dark_url"),
    logoBg: logoBg("logo_bg").notNull().default("transparent"),
    logoShape: logoShape("logo_shape").notNull().default("square"),
    brandColor: text("brand_color"),
    description: text("description"),
    website: text("website"),
    currency: text("currency").notNull().default("LKR"),
    sharesOutstanding: doublePrecision("shares_outstanding"),
    currentPrice: doublePrecision("current_price"),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
    status: companyStatus("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [index("companies_sector_idx").on(t.sectorId)],
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    price: doublePrecision("price").notNull(),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("price_history_company_date_uq").on(t.companyId, t.date)],
);

// ─── Reports and versions ─────────────────────────────────────────────────
export const financialReports = pgTable(
  "financial_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: reportType("type").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    fiscalPeriod: text("fiscal_period").notNull(),
    periodEnd: date("period_end", { mode: "string" }),
    currentVersionId: uuid("current_version_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("financial_reports_company_idx").on(t.companyId)],
);

export const reportVersions = pgTable(
  "report_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => financialReports.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    blobUrl: text("blob_url").notNull(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256"),
    pageCount: integer("page_count"),
    status: versionStatus("status").notNull().default("uploaded"),
    /** 0–100 progress while processing, for the dashboard queue. */
    progress: integer("progress").notNull().default(0),
    error: text("error"),
    note: text("note"),
    uploadedBy: uuid("uploaded_by").references(() => admins.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => admins.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("report_versions_report_idx").on(t.reportId),
    uniqueIndex("report_versions_report_no_uq").on(t.reportId, t.versionNo),
  ],
);

// ─── Extracted data ───────────────────────────────────────────────────────
export const financialMetrics = pgTable(
  "financial_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportVersionId: uuid("report_version_id")
      .notNull()
      .references(() => reportVersions.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fiscalYear: integer("fiscal_year").notNull(),
    /** "FY", "H1", "Q1".."Q4" */
    period: text("period").notNull().default("FY"),
    /** Statement figures are stored as reported; multiply by this to get units of currency. */
    unitMultiplier: doublePrecision("unit_multiplier").notNull().default(1),
    revenue: doublePrecision("revenue"),
    grossProfit: doublePrecision("gross_profit"),
    operatingIncome: doublePrecision("operating_income"),
    netIncome: doublePrecision("net_income"),
    /** Per-share figures are never scaled by unit_multiplier. */
    eps: doublePrecision("eps"),
    dps: doublePrecision("dps"),
    totalAssets: doublePrecision("total_assets"),
    totalLiabilities: doublePrecision("total_liabilities"),
    totalEquity: doublePrecision("total_equity"),
    currentAssets: doublePrecision("current_assets"),
    currentLiabilities: doublePrecision("current_liabilities"),
    totalDebt: doublePrecision("total_debt"),
    cash: doublePrecision("cash"),
    operatingCashFlow: doublePrecision("operating_cash_flow"),
    capex: doublePrecision("capex"),
    /** Share count in units (not scaled). */
    sharesOutstanding: doublePrecision("shares_outstanding"),
    /** { confidence: {field: 0–100}, other: {...} } */
    extra: jsonb("extra").$type<{ confidence?: Record<string, number>; other?: Record<string, number> }>(),
    /** { field: page } */
    sourcePages: jsonb("source_pages").$type<Record<string, number>>(),
    /** { field: original extracted value } for fields an admin edited */
    edits: jsonb("edits").$type<Record<string, number | null>>(),
    verified: boolean("verified").notNull().default(false),
    editedBy: uuid("edited_by").references(() => admins.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("financial_metrics_company_idx").on(t.companyId),
    index("financial_metrics_version_idx").on(t.reportVersionId),
  ],
);

export const qualitativeInsights = pgTable(
  "qualitative_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportVersionId: uuid("report_version_id")
      .notNull()
      .references(() => reportVersions.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    category: insightCategory("category").notNull(),
    summary: text("summary").notNull(),
    /** −1..+1 */
    sentiment: doublePrecision("sentiment").notNull(),
    impact: impactLevel("impact").notNull(),
    evidenceQuote: text("evidence_quote"),
    page: integer("page"),
    /** Reviewers can leave an insight out of the qualitative scoring. */
    included: boolean("included").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("qualitative_insights_company_idx").on(t.companyId),
    index("qualitative_insights_version_idx").on(t.reportVersionId),
  ],
);

export const companyEvents = pgTable(
  "company_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** −1..+1 */
    sentiment: doublePrecision("sentiment").notNull().default(0),
    sourceUrl: text("source_url"),
    createdBy: uuid("created_by").references(() => admins.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("company_events_company_idx").on(t.companyId)],
);

export const reportChunks = pgTable(
  "report_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportVersionId: uuid("report_version_id")
      .notNull()
      .references(() => reportVersions.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    page: integer("page"),
    chunkIndex: integer("chunk_index").notNull().default(0),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('english', content)`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("report_chunks_company_idx").on(t.companyId),
    index("report_chunks_version_idx").on(t.reportVersionId),
    index("report_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("report_chunks_tsv_idx").using("gin", t.tsv),
  ],
);

// ─── Predictions ──────────────────────────────────────────────────────────
export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: predictionStatus("status").notNull().default("draft"),
    /** Share price the prediction was computed from. */
    basePrice: doublePrecision("base_price").notNull(),
    currency: text("currency").notNull(),
    scenarios: jsonb("scenarios").$type<ScenarioSet>().notNull(),
    upsidePct: doublePrecision("upside_pct").notNull(),
    confidence: integer("confidence").notNull(),
    autoviseScore: integer("autovise_score").notNull(),
    assumptions: jsonb("assumptions").$type<Assumptions>().notNull(),
    factorScores: jsonb("factor_scores").$type<FactorScore[]>().notNull(),
    valuationBreakdown: jsonb("valuation_breakdown").$type<WaterfallStep[]>().notNull(),
    pitch: jsonb("pitch").$type<Pitch>(),
    citations: jsonb("citations").$type<Citation[]>(),
    basedOn: jsonb("based_on").$type<BasedOnReport[]>(),
    inputsHash: text("inputs_hash").notNull(),
    modelVersion: text("model_version").notNull(),
    trigger: text("trigger"),
    overrideNotes: jsonb("override_notes").$type<OverrideNote[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => admins.id, { onDelete: "set null" }),
  },
  (t) => [
    index("predictions_company_idx").on(t.companyId),
    uniqueIndex("predictions_company_version_uq").on(t.companyId, t.version),
  ],
);

// ─── Chat ─────────────────────────────────────────────────────────────────
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonId: text("anon_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("chat_sessions_anon_company_uq").on(t.anonId, t.companyId)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    role: chatRole("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").$type<Citation[]>(),
    /** 1 = helpful, −1 = unhelpful, 0/null = not rated */
    feedback: smallint("feedback"),
    feedbackReason: text("feedback_reason"),
    feedbackNote: text("feedback_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => admins.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("chat_messages_session_idx").on(t.sessionId),
    index("chat_messages_company_created_idx").on(t.companyId, t.createdAt),
  ],
);

// ─── Settings, audit, rate limit ──────────────────────────────────────────
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  /** Validated by settingsSchema in src/lib/settings.ts */
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => admins.id, { onDelete: "set null" }),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => admins.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

/** Fixed-window counters, used for chat rate limiting when Upstash is not configured. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export type Admin = typeof admins.$inferSelect;
export type Sector = typeof sectors.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type FinancialReport = typeof financialReports.$inferSelect;
export type ReportVersion = typeof reportVersions.$inferSelect;
export type FinancialMetric = typeof financialMetrics.$inferSelect;
export type QualitativeInsight = typeof qualitativeInsights.$inferSelect;
export type CompanyEvent = typeof companyEvents.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
