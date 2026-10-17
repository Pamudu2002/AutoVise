CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'admin', 'analyst');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."impact_level" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."insight_category" AS ENUM('management', 'strategy', 'outlook', 'risk', 'governance', 'esg', 'market', 'capital_allocation');--> statement-breakpoint
CREATE TYPE "public"."logo_bg" AS ENUM('light', 'dark', 'transparent');--> statement-breakpoint
CREATE TYPE "public"."logo_shape" AS ENUM('square', 'round', 'tall', 'wide');--> statement-breakpoint
CREATE TYPE "public"."prediction_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('annual', 'quarterly', 'interim', 'other');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('uploaded', 'processing', 'review', 'approved', 'failed', 'superseded');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'analyst' NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb,
	"feedback" smallint,
	"feedback_reason" text,
	"feedback_note" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ticker" text NOT NULL,
	"sector_id" uuid,
	"logo_url" text,
	"logo_dark_url" text,
	"logo_bg" "logo_bg" DEFAULT 'transparent' NOT NULL,
	"logo_shape" "logo_shape" DEFAULT 'square' NOT NULL,
	"brand_color" text,
	"description" text,
	"website" text,
	"currency" text DEFAULT 'LKR' NOT NULL,
	"shares_outstanding" double precision,
	"current_price" double precision,
	"price_updated_at" timestamp with time zone,
	"status" "company_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "companies_ticker_unique" UNIQUE("ticker")
);
--> statement-breakpoint
CREATE TABLE "company_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"sentiment" double precision DEFAULT 0 NOT NULL,
	"source_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_version_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period" text DEFAULT 'FY' NOT NULL,
	"unit_multiplier" double precision DEFAULT 1 NOT NULL,
	"revenue" double precision,
	"gross_profit" double precision,
	"operating_income" double precision,
	"net_income" double precision,
	"eps" double precision,
	"dps" double precision,
	"total_assets" double precision,
	"total_liabilities" double precision,
	"total_equity" double precision,
	"current_assets" double precision,
	"current_liabilities" double precision,
	"total_debt" double precision,
	"cash" double precision,
	"operating_cash_flow" double precision,
	"capex" double precision,
	"shares_outstanding" double precision,
	"extra" jsonb,
	"source_pages" jsonb,
	"edits" jsonb,
	"verified" boolean DEFAULT false NOT NULL,
	"edited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "report_type" NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_period" text NOT NULL,
	"period_end" date,
	"current_version_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "prediction_status" DEFAULT 'draft' NOT NULL,
	"base_price" double precision NOT NULL,
	"currency" text NOT NULL,
	"scenarios" jsonb NOT NULL,
	"upside_pct" double precision NOT NULL,
	"confidence" integer NOT NULL,
	"autovise_score" integer NOT NULL,
	"assumptions" jsonb NOT NULL,
	"factor_scores" jsonb NOT NULL,
	"valuation_breakdown" jsonb NOT NULL,
	"pitch" jsonb,
	"citations" jsonb,
	"based_on" jsonb,
	"inputs_hash" text NOT NULL,
	"model_version" text NOT NULL,
	"trigger" text,
	"override_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"date" date NOT NULL,
	"price" double precision NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualitative_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_version_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"category" "insight_category" NOT NULL,
	"summary" text NOT NULL,
	"sentiment" double precision NOT NULL,
	"impact" "impact_level" NOT NULL,
	"evidence_quote" text,
	"page" integer,
	"included" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_version_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"page" integer,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768),
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"blob_url" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text,
	"page_count" integer,
	"status" "version_status" DEFAULT 'uploaded' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"error" text,
	"note" text,
	"uploaded_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"benchmark_pe" double precision NOT NULL,
	"benchmark_growth" double precision NOT NULL,
	"benchmark_roe" double precision NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sectors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_admins_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_metrics" ADD CONSTRAINT "financial_metrics_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_metrics" ADD CONSTRAINT "financial_metrics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_metrics" ADD CONSTRAINT "financial_metrics_edited_by_admins_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_published_by_admins_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualitative_insights" ADD CONSTRAINT "qualitative_insights_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualitative_insights" ADD CONSTRAINT "qualitative_insights_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_chunks" ADD CONSTRAINT "report_chunks_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_chunks" ADD CONSTRAINT "report_chunks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_report_id_financial_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."financial_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_uploaded_by_admins_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_admins_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_company_created_idx" ON "chat_messages" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_anon_company_uq" ON "chat_sessions" USING btree ("anon_id","company_id");--> statement-breakpoint
CREATE INDEX "companies_sector_idx" ON "companies" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "company_events_company_idx" ON "company_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "financial_metrics_company_idx" ON "financial_metrics" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "financial_metrics_version_idx" ON "financial_metrics" USING btree ("report_version_id");--> statement-breakpoint
CREATE INDEX "financial_reports_company_idx" ON "financial_reports" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "predictions_company_idx" ON "predictions" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "predictions_company_version_uq" ON "predictions" USING btree ("company_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "price_history_company_date_uq" ON "price_history" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "qualitative_insights_company_idx" ON "qualitative_insights" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "qualitative_insights_version_idx" ON "qualitative_insights" USING btree ("report_version_id");--> statement-breakpoint
CREATE INDEX "report_chunks_company_idx" ON "report_chunks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "report_chunks_version_idx" ON "report_chunks" USING btree ("report_version_id");--> statement-breakpoint
CREATE INDEX "report_chunks_embedding_idx" ON "report_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "report_chunks_tsv_idx" ON "report_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "report_versions_report_idx" ON "report_versions" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_versions_report_no_uq" ON "report_versions" USING btree ("report_id","version_no");