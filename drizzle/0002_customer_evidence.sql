CREATE TYPE "public"."evidence_check_result" AS ENUM('agree', 'disagree');--> statement-breakpoint
CREATE TYPE "public"."evidence_coding_status" AS ENUM('uncoded', 'ai_suggested', 'coded', 'checked', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."evidence_exclusion" AS ENUM('advert', 'hearsay', 'irrelevant', 'duplicate', 'out_of_window', 'overseas', 'not_first_hand', 'other');--> statement-breakpoint
CREATE TYPE "public"."evidence_finding_status" AS ENUM('draft', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."evidence_language" AS ENUM('en', 'si', 'ta', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."evidence_platform" AS ENUM('google_play', 'reddit', 'trustpilot', 'facebook', 'google_maps', 'other');--> statement-breakpoint
CREATE TYPE "public"."evidence_product" AS ENUM('mobile', 'app', 'home_broadband', 'air_fibre', 'fibre', 'satellite', 'unclear');--> statement-breakpoint
CREATE TYPE "public"."evidence_report_section" AS ENUM('value_perception', 'multi_sim_moat', 'fixed_broadband', 'investment_risks', 'other');--> statement-breakpoint
CREATE TYPE "public"."evidence_screen_decision" AS ENUM('pending', 'selected', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."evidence_sentiment" AS ENUM('positive', 'mixed', 'negative', 'unclear');--> statement-breakpoint
CREATE TYPE "public"."evidence_source" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."evidence_study_status" AS ENUM('draft', 'screening', 'collecting', 'coding', 'checking', 'complete');--> statement-breakpoint
CREATE TYPE "public"."evidence_support" AS ENUM('supports', 'contradicts', 'explains', 'qualifies');--> statement-breakpoint
CREATE TABLE "evidence_comparison_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_duplicate_dismissals" (
	"study_id" uuid NOT NULL,
	"record_a" uuid NOT NULL,
	"record_b" uuid NOT NULL,
	"dismissed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_duplicate_dismissals_record_a_record_b_pk" PRIMARY KEY("record_a","record_b")
);
--> statement-breakpoint
CREATE TABLE "evidence_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"company_id" uuid,
	"is_subject" boolean DEFAULT false NOT NULL,
	"requires_geo_check" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"research_question_id" uuid,
	"report_section" "evidence_report_section" NOT NULL,
	"text" text NOT NULL,
	"support" "evidence_support" DEFAULT 'explains' NOT NULL,
	"cited_record_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"guard_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "evidence_finding_status" DEFAULT 'draft' NOT NULL,
	"generated_by" "evidence_source" DEFAULT 'human' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_platform_screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"platform" "evidence_platform" NOT NULL,
	"decision" "evidence_screen_decision" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"search_terms" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"sort_method" text,
	"coverage_note" text,
	"screened_by" uuid,
	"screened_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "evidence_record_themes" (
	"record_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"source" "evidence_source" DEFAULT 'human' NOT NULL,
	CONSTRAINT "evidence_record_themes_record_id_theme_id_pk" PRIMARY KEY("record_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"record_code" text NOT NULL,
	"platform" "evidence_platform" NOT NULL,
	"source_url" text,
	"posted_at" date,
	"collection_date" date,
	"thread_id" text,
	"contributor_ref" text,
	"star_rating" smallint,
	"entity_id" uuid NOT NULL,
	"product" "evidence_product" DEFAULT 'unclear' NOT NULL,
	"product_evidence" text,
	"geo_confirmed" boolean DEFAULT false NOT NULL,
	"text" text NOT NULL,
	"language" "evidence_language" DEFAULT 'en' NOT NULL,
	"translation_en" text,
	"sentiment" "evidence_sentiment",
	"switching" boolean DEFAULT false NOT NULL,
	"switching_note" text,
	"coding_status" "evidence_coding_status" DEFAULT 'uncoded' NOT NULL,
	"coded_by" uuid,
	"coded_at" timestamp with time zone,
	"included" boolean DEFAULT true NOT NULL,
	"exclusion_reason" "evidence_exclusion",
	"inclusion_note" text,
	"duplicate_of_id" uuid,
	"in_qa_sample" boolean DEFAULT false NOT NULL,
	"checked_by" uuid,
	"check_result" "evidence_check_result",
	"check_fields" jsonb,
	"check_note" text,
	"checked_at" timestamp with time zone,
	"ai_suggestion" jsonb,
	"embedding" vector(768),
	"public_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_research_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"question" text NOT NULL,
	"report_section" "evidence_report_section" NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "evidence_study_status" DEFAULT 'draft' NOT NULL,
	"collection_date" date NOT NULL,
	"window_months" integer DEFAULT 6 NOT NULL,
	"window_start" date NOT NULL,
	"languages" "evidence_language"[] DEFAULT ARRAY['en']::evidence_language[] NOT NULL,
	"language_limitations" text,
	"min_n_for_percent" integer DEFAULT 20 NOT NULL,
	"qa_rate" double precision DEFAULT 0.2 NOT NULL,
	"notes" text,
	"limitations" text,
	"appendix_published" boolean DEFAULT false NOT NULL,
	"template_key" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"label" text NOT NULL,
	"group_id" uuid,
	"product" "evidence_product",
	"platform" "evidence_platform",
	"per_entity" boolean DEFAULT false NOT NULL,
	"target_min" integer NOT NULL,
	"target_max" integer NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"investment_relevance" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_comparison_groups" ADD CONSTRAINT "evidence_comparison_groups_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_duplicate_dismissals" ADD CONSTRAINT "evidence_duplicate_dismissals_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_duplicate_dismissals" ADD CONSTRAINT "evidence_duplicate_dismissals_dismissed_by_admins_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_entities" ADD CONSTRAINT "evidence_entities_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_entities" ADD CONSTRAINT "evidence_entities_group_id_evidence_comparison_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."evidence_comparison_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_entities" ADD CONSTRAINT "evidence_entities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_research_question_id_evidence_research_questions_id_fk" FOREIGN KEY ("research_question_id") REFERENCES "public"."evidence_research_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_platform_screenings" ADD CONSTRAINT "evidence_platform_screenings_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_platform_screenings" ADD CONSTRAINT "evidence_platform_screenings_screened_by_admins_id_fk" FOREIGN KEY ("screened_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_record_themes" ADD CONSTRAINT "evidence_record_themes_record_id_evidence_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."evidence_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_record_themes" ADD CONSTRAINT "evidence_record_themes_theme_id_evidence_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."evidence_themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_entity_id_evidence_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."evidence_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_coded_by_admins_id_fk" FOREIGN KEY ("coded_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_checked_by_admins_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_research_questions" ADD CONSTRAINT "evidence_research_questions_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_studies" ADD CONSTRAINT "evidence_studies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_studies" ADD CONSTRAINT "evidence_studies_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_targets" ADD CONSTRAINT "evidence_targets_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_targets" ADD CONSTRAINT "evidence_targets_group_id_evidence_comparison_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."evidence_comparison_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_themes" ADD CONSTRAINT "evidence_themes_study_id_evidence_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."evidence_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_findings_study_idx" ON "evidence_findings" USING btree ("study_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_screenings_study_platform_uq" ON "evidence_platform_screenings" USING btree ("study_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_records_study_code_uq" ON "evidence_records" USING btree ("study_id","record_code");--> statement-breakpoint
CREATE INDEX "evidence_records_study_entity_idx" ON "evidence_records" USING btree ("study_id","entity_id");--> statement-breakpoint
CREATE INDEX "evidence_records_study_platform_idx" ON "evidence_records" USING btree ("study_id","platform");--> statement-breakpoint
CREATE INDEX "evidence_records_study_status_idx" ON "evidence_records" USING btree ("study_id","coding_status");--> statement-breakpoint
CREATE INDEX "evidence_records_embedding_idx" ON "evidence_records" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "evidence_studies_company_idx" ON "evidence_studies" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_themes_study_key_uq" ON "evidence_themes" USING btree ("study_id","key");