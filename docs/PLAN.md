# AutoVise — Full Build Plan

## Context
AutoVise automates the investment consultant's job. Visitors browse company cards that show the
current share price and a 3‑year predicted price. Opening a card shows a consultant-style "pitch":
how the prediction was reached and why, plus a chatbot for the Q&A that follows a pitch. Admins add
companies, upload financial reports (PDF/Excel) and replace them; every upload or change
re-extracts the data and recomputes that company's figures, prediction and pitch. Predictions must
use both the quantitative data (financial statements) and the qualitative data (management
commentary, risks, strategy).

This is a new project. Decisions already made: Next.js + Neon Postgres, Gemini API for AI, prices entered by
admins (no market feed), Vercel Blob for files, and only admins log in (visitors need no account).

---

## 1. Tech stack
| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript, Server Actions) | Required; one codebase for the site, admin panel and API |
| UI | Tailwind CSS + shadcn/ui, Recharts, lucide icons | Quick to build, looks professional |
| DB | Neon Postgres + **pgvector** extension | Required; pgvector keeps report embeddings for the chatbot in the same DB |
| ORM | Drizzle ORM + `postgres` (postgres-js) driver + drizzle-kit migrations; optional embedded PGlite (`DATABASE_URL=pglite:…`) for zero-setup local work | One driver for Neon and any Postgres 16 + pgvector; PGlite (with pgvector) lets the app and tests run without Docker |
| Auth | Auth.js v5 (credentials with bcrypt; Google optional), admin roles | Admin-only login |
| Files | Vercel Blob for report files and company logos (client uploads, so large PDFs skip the function body limit) | Chosen |
| Images | `next/image` for logos (optimised and lazy-loaded), `sharp` server-side to resize and convert uploaded logos | Sharp logos on cards and the company page |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/google`) with Gemini 2.5 Flash for extraction and chat, Gemini 2.5 Pro for the pitch, `gemini-embedding-001` (768 dims) | Streaming chat, structured output checked with Zod, embeddings, all through one SDK |
| Background jobs | Inngest (free tier) | Report processing takes longer than a request allows. Inngest gives step retries and a per-company debounce, so several uploads trigger only one recompute |
| Parsing | `unpdf` (PDF text per page), SheetJS `xlsx` (Excel → CSV); Gemini reads the PDF natively for structured extraction and scanned files | |
| Validation / forms | Zod (forms are small controlled components; Zod validates in every server action) | react-hook-form was not needed |
| PDFs | `pdf-lib` | Downloadable pitch one-pager and the seed's sample report PDFs |
| Rate limiting | Upstash Ratelimit (or a DB counter) on the public chat | Stops abuse of the Gemini key |
| Tests | Vitest (valuation engine, pipeline), Playwright (end-to-end) | |
| Hosting | Vercel + Neon (preview branches per PR) | |

---

## 2. System architecture
```
Visitor ──► Public pages (RSC) ──► Neon (companies, published predictions)
        └─► /api/chat (streamed) ──► RAG retrieve (pgvector) + metrics + prediction ──► Gemini

Admin ──► Admin panel ──► Server Actions ──► Neon
      └─► Upload ──► Vercel Blob ──► event "report/version.uploaded" ──► Inngest
                                                                         │
   ┌─────────────────────── process-report (per file version) ──────────┘
   │ 1 parse text (unpdf / xlsx)      2 Gemini structured extraction (quant + qual)
   │ 3 chunk + embed → report_chunks  4 status = "review" (admin verifies) or auto-approve
   └─► event "company/recompute" (debounced 30s per company)
         recompute-company: aggregate metrics → ratios → valuation engine
         → qualitative scoring → scenarios → Gemini pitch narrative → new prediction (draft/published)
```

**The update rule:** each report has versions. Uploading a replacement creates a new
`report_version` and marks the old one `superseded`. Its metrics, insights and chunks drop out of
every query, which only reads current versions. Deleting a report soft-deletes it. Every one of
these changes sends `company/recompute`, so the company's metrics, prediction, pitch and chatbot
knowledge always match its current files. Each job first checks that its version is still current
and skips stale work.

---

## 3. Database schema (Drizzle, `src/lib/db/schema.ts`)
- **admins**: id, email, name, password_hash, role (`super_admin` | `admin` | `analyst`), timestamps
- **sectors**: id, name, benchmark_pe, benchmark_growth, benchmark_roe, notes
- **companies**: id, slug, name, ticker, sector_id, logo_url, logo_dark_url (optional version for
  the dark theme), logo_bg (`light` | `dark` | `transparent`, the tile colour that suits the logo),
  brand_color (optional hex for subtle card accents), description, website, currency,
  shares_outstanding, current_price, price_updated_at, status (`draft` | `published`), timestamps
- **price_history**: company_id, date, price (from admin entry or CSV import; feeds charts and the accuracy tracker)
- **financial_reports**: id, company_id, title, type (`annual` | `quarterly` | `interim` | `other`),
  fiscal_year, fiscal_period, period_end, current_version_id, deleted_at, timestamps
- **report_versions**: id, report_id, version_no, blob_url, file_name, mime, size, sha256,
  status (`uploaded` | `processing` | `review` | `approved` | `failed` | `superseded`), error, uploaded_by, created_at
- **financial_metrics**: id, report_version_id, company_id, fiscal_year, period, unit_multiplier,
  revenue, gross_profit, operating_income, net_income, eps, dps, total_assets, total_liabilities,
  total_equity, current_assets, current_liabilities, total_debt, cash, operating_cash_flow, capex,
  shares_outstanding, extra (jsonb), source_pages (jsonb), verified (bool), edited_by
- **qualitative_insights**: id, report_version_id, company_id, category (`management` | `strategy` |
  `outlook` | `risk` | `governance` | `esg` | `market` | `capital_allocation`), summary, sentiment (−1..1),
  impact (`low` | `med` | `high`), evidence_quote, page
- **company_events**: admin-entered news (CEO change, new contract, regulation): date, title, body,
  sentiment, source_url. These are qualitative inputs too
- **report_chunks**: id, report_version_id, company_id, page, content, embedding `vector(768)` (HNSW index), tsvector for hybrid search
- **predictions**: id, company_id, version, status (`draft` | `published` | `archived`), base_price,
  scenarios jsonb `{bear,base,bull: {y1,y2,y3}}`, upside_pct, confidence (0–100), autovise_score,
  assumptions jsonb, factor_scores jsonb, valuation_breakdown jsonb (waterfall),
  pitch jsonb (sections + citations), inputs_hash, model_version, created_at, published_at/by, admin_override_note
- **chat_sessions / chat_messages**: anonymous cookie id, company_id, role, content, citations, feedback (👍/👎)
- **settings**: valuation weights and caps, auto-publish toggle, disclaimer text
- **audit_logs**: actor, action, entity, before/after jsonb

---

## 4. Prediction engine (quantitative + qualitative, explainable)
The numbers come from deterministic code. The LLM scores the qualitative factors and writes the
words, but it never invents the price. Lives in `src/lib/valuation/` as pure, unit-tested functions.

1. **Ratios** (`ratios.ts`): growth (revenue/EPS CAGR), margins, ROE, ROA, debt/equity, current
   ratio, FCF yield, payout ratio, P/E, P/B, dividend yield, plus data-completeness flags.
2. **Base projection** (`projection.ts`):
   - EPS growth g = a blend of historical EPS CAGR, sustainable growth (ROE × retention) and the sector
     benchmark, with weights from settings, mean-reverting toward the sector benchmark each year.
   - Exit multiple = current P/E moving toward the sector P/E.
   - Price_y = EPS_y × P/E_y. A dividend-discount cross-check runs when the company pays dividends;
     the final figure is a weighted blend.
3. **Qualitative overlay** (`qualitative.ts`): Gemini rates 6 factors (management quality, growth
   outlook, competitive position, risk profile, governance, sentiment from events) from −1 to +1,
   each with a justification and cited evidence. The ratings shift the growth rate and the multiple
   within caps set in settings (for example ±3 pp growth and ±15 % multiple), so qualitative
   factors adjust the numbers but cannot override them. *Implemented:* the weighted composite of the
   six scores drives both shifts, and the combined price effect is also capped at ±10 % (the design's
   "qualitative tilt"). Without Gemini a deterministic heuristic scores the factors from the
   extracted insights and events.
4. **Scenarios** (`scenarios.ts`): bear, base and bull come from shifting the growth and multiple
   assumptions by set amounts.
5. **Confidence**: based on how complete the data is, how many years of history exist, earnings
   volatility, and how much the factor scores disagree.
6. **Valuation breakdown (waterfall)**: current price → earnings growth effect → multiple change →
   qualitative adjustment → base target. Stored so the "how" page can draw it.
7. **Pitch generation**: Gemini 2.5 Pro gets the computed JSON and the top insights and returns
   structured sections: Investment thesis, Key drivers, Valuation walkthrough, Risks, Catalysts,
   What would change our view. Each section carries citations to report and page. A Zod schema
   rejects any number that does not appear in the inputs.
8. **Admin review**: predictions land as `draft` unless auto-publish is on. Admins can publish, add
   an override note, or rerun. Older predictions are kept for history and accuracy tracking.

---

## 5. Pages and routes
**Public**
- `/` — company card grid: company logo (top-left, see §5.1), name, ticker, sector, current price,
  3-year base target, upside % badge, confidence, mini sparkline. Search, sector filter, sort (by upside, confidence or name).
- `/companies/[slug]` — the pitch page:
  - Header with the large company logo, name, ticker, sector and website link, then the price, a chart of history plus the projected bear/base/bull band for years 1–3, and the AutoVise score
  - "The Pitch" tab with the narrative sections and citations (each opens the report page)
  - "How we got here" tab with the waterfall, assumptions table, factor-score radar and ratio table
  - "Financials" tab with multi-year metrics and the list of source reports
  - What-if simulator: sliders for growth, P/E and the qualitative tilt, recalculated in the browser (the same valuation functions run there)
  - Chat panel ("Ask the consultant") with suggested questions, streamed answers and source citations
- `/compare?c=a,b,c` — up to 3 companies side by side
- `/track-record` — past published predictions against actual prices (builds trust)
- `/methodology`, `/disclaimer`
- Logos also appear on the compare page, track record rows, the chat panel header, the downloadable
  pitch PDF and each company's OG/social share image.

### 5.1 Company logos
- **Admin upload** (company create/edit form): drag-and-drop or click to upload PNG, SVG, JPG or WebP,
  up to 2 MB. Shows a live preview of how the logo will look on a public card in both light and dark
  themes, with a square crop/fit tool, a "tile background" choice (light, dark, transparent) and an
  optional separate dark-theme logo. Replace and remove buttons are included.
- **Processing**: uploads go to Vercel Blob under `logos/{companyId}/`. Raster images are trimmed,
  padded to a square and resized to 512×512 WebP with `sharp`; SVGs are sanitised (scripts and
  external references removed) before storing. Replacing a logo deletes the old blob, writes an audit
  log entry and revalidates the company's pages.
- **Card display**: the logo sits in a fixed-size rounded square tile (48×48 on cards, 96×96 on the
  company header) with a thin border and consistent padding. It uses `object-contain` so logos are never
  stretched or cropped, and every logo is the same visual size regardless of its shape.
- **Fallback**: when there is no logo, or it fails to load, show a monogram tile with the company's
  initials on a colour taken from `brand_color` (or a colour derived from the ticker), so cards stay
  consistent.
- **Accessibility**: `alt` text is "{Company name} logo"; the dark-theme logo is used automatically in dark mode.

**Admin** (`/admin`, protected by middleware plus role checks)
- Dashboard: processing queue and statuses, failed jobs, stale-price warnings, chat stats
- Companies: create, edit and publish; logo upload with live card preview (§5.1); the companies table
  shows each logo thumbnail; price updates (single or CSV bulk)
- Company → Reports: upload (drag and drop, several at once), replace (new version), delete, version history
- Report review: side-by-side PDF viewer and extracted metrics and insights, inline edit, approve
- Company → Predictions: draft against published diff, publish, rerun, override note
- Company → Events (news), Sectors (benchmarks), Settings (weights, caps, auto-publish)
- Chat insights: most-asked questions and answers marked 👎, which show where the pitch is weak
- Admin users and audit log

**API**: `/api/auth/[...nextauth]`, `/api/upload` (Vercel Blob `handleUpload` with an admin check),
`/api/chat` (streamText), `/api/inngest`, `/api/companies/[slug]/pitch.pdf` (downloadable one-pager)

---

## 6. Chatbot (pitch Q&A)
- `/api/chat` with `streamText` (Gemini Flash). Context includes the company profile, latest
  metrics, the published prediction's assumptions and pitch, and the top 8 report chunks from
  hybrid search (pgvector + full-text) on the question.
- Tools the model can call: `getMetric(year, field)`, `compareYears`, `runScenario(growth, pe)`
  (uses the same valuation engine), and `searchReports(query)`.
- Persona: a calm consultant defending the pitch. It cites sources, says when the data does not
  cover a question, does not give personal financial advice, and states that predictions are
  estimates.
- Per-IP and per-session rate limits; conversations are logged for the chat-insights page.

---

## 7. Folder structure
```
src/
  app/
    (public)/page.tsx, companies/[slug]/page.tsx, compare/, track-record/, methodology/
    admin/login/, admin/(panel)/{page,companies,reports,predictions,sectors,events,settings,chat-insights,users,audit}/
    api/{auth,upload,chat,inngest,companies}/
  components/{ui,company-card,company-logo,admin/logo-uploader,price-projection-chart,valuation-waterfall,factor-radar,pitch-sections,chat-panel,simulator,admin/*}
  lib/
    db/{schema.ts,index.ts}   auth.ts   blob.ts   logo.ts (sharp resize, SVG sanitise)   ratelimit.ts
    ai/{gemini.ts,schemas.ts,prompts/{extract,qualitative,pitch,chat}.ts}
    pipeline/{parse.ts,extract.ts,chunk.ts,embed.ts}
    valuation/{ratios,projection,qualitative,scenarios,confidence,index}.ts  (+ *.test.ts)
    rag/retrieve.ts
  inngest/{client.ts,functions/{process-report,recompute-company}.ts}
  middleware.ts
drizzle/ (migrations)   scripts/seed.ts   drizzle.config.ts   .env.example
```
Env: `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_GENERATIVE_AI_API_KEY`, `BLOB_READ_WRITE_TOKEN`,
`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`.

---

## 8. Additional features
Must-have in v1: version history for reports, admin review of extracted data, bear/base/bull
scenarios, confidence score, cited pitch, what-if simulator, disclaimers.
Next: compare page, track record, chat insights, downloadable pitch PDF, news events feeding
the qualitative score, CSV price import, an "outdated" badge when the newest report is more than 12
months old, SEO and OG images per company.
Later: optional visitor accounts (watchlist, alerts when a prediction changes), Sinhala and Tamil
pitch translation through Gemini, an audio pitch using Gemini TTS, a peer and sector dashboard, and
a market price feed when one is available.

---

## 9. Build phases (each ends deployable)
0. **Setup**: Next.js, Tailwind/shadcn, Drizzle, Neon (with pgvector), Auth.js admin login, seed super-admin, `.env.example`, CI (lint, typecheck, Vitest).
1. **Companies**: admin company and sector CRUD, logo upload and processing with monogram fallback, price entry and history, public card grid with logos and a basic detail page.
2. **Reports pipeline**: Blob upload, versions, Inngest `process-report` (parse, extract, embed), review screen, replace and delete triggering recompute.
3. **Prediction engine**: valuation library with tests, qualitative scoring, scenarios, pitch generation, predictions admin page, full pitch page with charts, waterfall and simulator.
4. **Chatbot**: RAG retrieval, tools, streaming chat panel, rate limit, logging.
5. **Extras**: compare page, track record, chat insights, pitch PDF, events, CSV import.
6. **Hardening**: Playwright end-to-end, error states, audit log, caching (`revalidateTag` per company after recompute), SEO, disclaimer review.

Implementation starts with Phase 0 and 1. Code is committed and pushed to GitHub manually by the project owner (see `CLAUDE.md`).

**Status (Oct 2026):** phases 0–6 are implemented. See §11 for decisions made during the build.

---

## 10. Verification
- **Unit**: Vitest on `lib/valuation/*` with known numbers (for example EPS 10, g 10 %, P/E 12 → expected y1–y3), caps on the qualitative overlay, scenario ordering (bear ≤ base ≤ bull), Zod schemas rejecting invented numbers.
- **Pipeline**: run `scripts/seed.ts` with a sample annual-report PDF through Inngest dev server
  (`npx inngest-cli dev`). Check that metrics, insights and chunks are created; replace the file
  and check that the old version is superseded and the prediction is rebuilt with a new
  inputs_hash; delete it and check the company recomputes.
- **End-to-end (Playwright, Chromium already installed)**: admin login → create company → upload
  report → approve → publish prediction → public card shows price, target and upside → detail page
  shows waterfall and citations → a chat question gets a streamed, cited answer.
- **Manual**: `npm run dev`, confirm the projection chart and simulator update live, and the chat rate limit returns 429 when exceeded.

---

## 11. Implementation notes (decisions made during the build)

**Local fallbacks.** Every external service is optional in development, so the app runs with only a
database: files go to `.data/uploads` and are served by `/api/files` when `BLOB_READ_WRITE_TOKEN` is
missing; jobs run in-process (Next.js `after()`, with per-company coalescing of recomputes) when
Inngest is not configured; the chat rate limit uses a Postgres fixed-window counter (`rate_limits`)
without Upstash; without Gemini, extraction is skipped (figures can be entered by hand on the review
screen), factor scores use a deterministic heuristic, the pitch is written by a deterministic
template, and the chat shows as offline.

**Schema additions** (beyond §3): `admins.failed_attempts / locked_until / disabled` (5 failed
sign-ins lock an account for 15 minutes); `companies.logo_shape` (detected on upload, sets the tile
padding from the design); `report_versions.progress / page_count / note / approved_by / approved_at /
processed_at`; `financial_metrics.edits` (original values of hand-edited figures) and per-field
confidence in `extra`; `qualitative_insights.included` (reviewers can exclude an insight);
`predictions.override_notes` (a jsonb list replacing `admin_override_note`), `based_on`, `trigger`,
`currency`; `chat_messages.feedback_reason / feedback_note / reviewed_at / reviewed_by`;
`settings` is a single row holding Zod-validated jsonb (`src/lib/settings.ts`).

**Valuation engine defaults** (all editable in Settings): growth blend 40 % record / 30 % sustainable
/ 30 % sector; 25 % of the gap to sector growth closes each year; the exit P/E moves 50 % of the way
to the sector P/E; growth −10 %…30 %, exit P/E 4×…25×; qualitative shifts ±3 pp growth and ±15 %
multiple with a ±10 % total cap; scenarios ±4 pp growth and ±15 % P/E; dividend cross-check weight
10 % at a 14 % cost of equity. The browser simulator calls the same `runScenario()`.
Confidence = completeness 25 %, history 20 %, earnings stability 20 %, factor agreement 10 %,
recency 10 %, bear–bull spread 15 %. AutoVise Score = 40 % upside, 40 % qualitative quality,
20 % confidence (from the design). A recompute is skipped when the `inputs_hash` is unchanged.

**Pitch grounding.** Gemini receives only the computed facts (`src/lib/predictions/facts.ts`) and a
numbered source list (`S1…`). `makePitchSchema()` rejects any number not present in those inputs
and any unknown source id; one retry with the errors, then the template pitch.

**Track record.** Each published prediction is scored at 12, 24 and 36 months against the closing
price on or just before the checkpoint (within 14 days). A hit is an actual price inside the
bear–bull band for that year.

**Routes added or refined.** `/admin/companies/[slug]/reports` (per company), `/admin/reports`
(all companies), `/admin/reports/[versionId]/review`, `/admin/predictions?company=…`;
`/companies/[slug]?preview=<predictionId>` lets admins preview a draft pitch; `/sitemap.xml`,
`/robots.txt`, and a per-company OG image.

**Folder additions.** `src/lib/{actions,data,predictions,jobs,reports}/`, plus `settings.ts`,
`env.ts`, `format.ts`, `logo-tile.ts`, `cache.ts`, `prices.ts`, `pitch-pdf.ts`, `chat.ts`.
UI components are hand-built from the design tokens in `src/app/globals.css` (ported from
`design/autovise-design/autovise.css`) rather than generated with the shadcn CLI.

**Not built yet** (from §8 "Later"): visitor accounts, translations, audio pitch, sector dashboard,
market price feed; Google sign-in for admins is also not enabled.
