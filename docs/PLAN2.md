# AutoVise — Plan 2: Customer Evidence Module

> **For Claude Code:** read `CLAUDE.md` and `docs/PLAN.md` first. This module builds on them and
> follows the same stack, folder layout and rules. Implement the tasks in §10 in order; each one
> lists what "done" means. **Do not commit or push** — list changed files and suggest a commit
> message when finished. Run lint, type-check and tests before calling a task done.

---

## 1. Context
AutoVise's predictions use quantitative data (financial reports) and qualitative data (report
commentary, admin-entered events). Analysts also run small **customer-experience studies**: they
screen public platforms (Google Play, Reddit, Trustpilot, Facebook, Google Maps), collect recent
first-hand customer accounts about a company and its competitors, code them by theme, and use the
strongest patterns to explain survey findings and test competitive threats.

Example study (the template this module ships with): **Dialog Axiata**
- Research questions: why value-for-money perception is weak; why users take another operator
  for data or switch; what trade-offs drive home-broadband choice.
- Comparison groups kept separate: **Mobile** (Dialog, Mobitel, Hutch) and **Home broadband**
  (Dialog Home Broadband / Air Fibre, SLT Fibre, Starlink).

This module gives that workflow a home in the admin panel: study setup → platform screening →
evidence import → AI-assisted coding → second-person check → theme analysis → 2–3 approved
findings that appear in the company's pitch, plus a public methodology appendix.

**Intended outcome:** better-explained pitches and risks, with a transparent, repeatable method.

## 2. Non-negotiable rules
1. **Evidence never changes numbers.** The valuation engine (`src/lib/valuation/`) and the
   `recompute-company` job must not read any `evidence_*` table. Approved findings only feed the
   pitch text, risks section, chatbot context and appendix.
2. **No overall operator score.** Never compute or display a combined satisfaction score or ranking,
   never pool star ratings across platforms, and never compare app complaints with network or
   satellite complaints in the same table.
3. **Counts are not failure rates.** Every count is shown with its denominator, thread count and
   contributor count. Below the small-sample threshold (default n < 20), show counts and quotes only,
   no percentages.
4. **No scraping.** Google Play's API only covers an app's own reviews; Reddit restricts commercial
   API use; Trustpilot, Facebook and Google Maps forbid scraping. Records come from team spreadsheet
   import or manual entry. URLs are stored for traceability only — the app does not fetch them.
5. **Privacy.** Never store usernames, profile links or personal details. Contributors are identified
   only by a team-assigned pseudonymous reference (for example `T03-C2`) so contributors can be counted.
6. **Proportionate conclusions.** AI-drafted findings cannot claim "most customers", churn amounts,
   market share or threat size. A guard function flags such wording (§7.4); an admin must approve
   every finding.
7. **Product precision.** A record is coded `air_fibre` only when the source explicitly names the
   product (`product_evidence` holds the quote). Older/unspecified Dialog home broadband is `home_broadband`.
8. **Location precision.** Entities marked `requires_geo_check` (for example Starlink) only accept
   records with `geo_confirmed = true` (Sri Lankan experience). Overseas accounts are excluded,
   never used to reach a target.

---

## 3. Dependencies on PLAN.md
- Required: Phase 0 (setup, auth, roles, `audit_logs`), Phase 1 (companies), `src/lib/ai/gemini.ts`.
- Integrates with Phase 3 (pitch generation) and Phase 4 (chatbot) when they exist. If they do not
  exist yet, build the module standalone and add the integration hooks in task E9.
- Reuses: SheetJS `xlsx` (import), `gemini-embedding-001` at 768 dims + pgvector (duplicate
  detection), Inngest (batch coding), Zod (all AI output).

---

## 4. Database schema (add to `src/lib/db/schema.ts`, then `npx drizzle-kit generate`)

Enums:
- `evidence_study_status`: `draft` | `screening` | `collecting` | `coding` | `checking` | `complete`
- `evidence_platform`: `google_play` | `reddit` | `trustpilot` | `facebook` | `google_maps` | `other`
- `evidence_screen_decision`: `pending` | `selected` | `excluded`
- `evidence_product`: `mobile` | `app` | `home_broadband` | `air_fibre` | `fibre` | `satellite` | `unclear`
- `evidence_sentiment`: `positive` | `mixed` | `negative` | `unclear`
- `evidence_language`: `en` | `si` | `ta` | `mixed`
- `evidence_exclusion`: `advert` | `hearsay` | `irrelevant` | `duplicate` | `out_of_window` | `overseas` | `not_first_hand` | `other`
- `evidence_coding_status`: `uncoded` | `ai_suggested` | `coded` | `checked` | `disputed`
- `evidence_report_section`: `value_perception` | `multi_sim_moat` | `fixed_broadband` | `investment_risks` | `other`
- `evidence_finding_status`: `draft` | `approved` | `rejected`

Tables:
- **evidence_studies**: id, company_id → companies, title, status, collection_date, window_months
  (default 6), window_start (computed = collection_date − window_months), languages (`evidence_language[]`),
  language_limitations (text), min_n_for_percent (default 20), qa_rate (default 0.2), notes,
  template_key, created_by, timestamps
- **evidence_research_questions**: id, study_id, question, report_section, sort
- **evidence_comparison_groups**: id, study_id, name ("Mobile", "Home broadband"), sort
- **evidence_entities**: id, study_id, group_id, name ("Dialog", "Starlink"), company_id (nullable link
  to a listed company), is_subject (the company being pitched), requires_geo_check (bool)
- **evidence_themes**: id, study_id, key, label, description, investment_relevance, sort
- **evidence_platform_screenings**: id, study_id, platform, decision, reason, search_terms (text[]),
  sort_method, coverage_note, screened_by, screened_at
- **evidence_targets**: id, study_id, label ("Mobile app reviews"), group_id, product (nullable),
  platform (nullable), per_entity (bool), target_min, target_max
- **evidence_records**:
  - identity: id, study_id, record_code (`R001`, unique per study)
  - source: platform, source_url, posted_at (date), collection_date, thread_id (nullable),
    contributor_ref (pseudonymous, nullable), star_rating (nullable; stored, never pooled)
  - subject: entity_id, product, product_evidence (required when product = `air_fibre`),
    geo_confirmed (bool)
  - content: text (relevant excerpt or accurate paraphrase), language, translation_en (nullable)
  - coding: sentiment, switching (bool), switching_note, coding_status, coded_by, coded_at
  - inclusion: included (bool), exclusion_reason (nullable), inclusion_note, duplicate_of_id (nullable)
  - QA: in_qa_sample (bool), checked_by (must differ from coded_by), check_result (`agree` | `disagree` | null),
    check_note, checked_at
  - AI: ai_suggestion (jsonb, last Gemini output), embedding `vector(768)` (HNSW, cosine)
  - public_example (bool — admin chooses paraphrased examples for the appendix), timestamps
- **evidence_record_themes**: record_id, theme_id, source (`ai` | `human`); primary key (record_id, theme_id)
- **evidence_findings**: id, study_id, research_question_id, report_section, text, support
  (`supports` | `contradicts` | `explains` | `qualifies`), cited_record_ids (int[]), guard_warnings (jsonb),
  status, generated_by (`ai` | `human`), approved_by, approved_at, timestamps

Indexes: records by (study_id, entity_id), (study_id, platform), (study_id, coding_status); unique
(study_id, record_code); HNSW on embedding.

---

## 5. Folder structure (new files only)
```
src/
  app/
    admin/(panel)/companies/[id]/evidence/page.tsx          # studies list for a company + "New study"
    admin/(panel)/evidence/[studyId]/
      layout.tsx                                             # study header + tabs + progress bar
      page.tsx                                               # Overview: status, targets progress, warnings
      setup/page.tsx                                         # questions, groups, entities, themes, window, languages
      screening/page.tsx                                     # platform screening log
      records/page.tsx                                       # table with filters, inline edit, bulk actions
      records/import/page.tsx                                # CSV/XLSX upload, column mapping, preview, validation
      records/[recordId]/page.tsx                            # single record edit
      coding/page.tsx                                        # AI suggestions queue: accept / edit / reject
      qa/page.tsx                                            # second-person check queue + agreement stats
      analysis/page.tsx                                      # theme matrices per group/platform/product
      findings/page.tsx                                      # draft, guard, edit, approve findings
      appendix/page.tsx                                      # preview of the public appendix
      actions.ts                                             # server actions (auth + role + audit log)
    (public)/companies/[slug]/evidence/page.tsx              # public appendix
    api/evidence/[studyId]/export/route.ts                   # CSV export (no personal data)
    api/evidence/[studyId]/import-template/route.ts          # blank XLSX template download
  components/evidence/
    study-tabs.tsx  targets-progress.tsx  screening-table.tsx  records-table.tsx
    import-mapper.tsx  coding-card.tsx  qa-card.tsx  theme-matrix.tsx
    sample-breakdown.tsx  finding-editor.tsx  evidence-appendix.tsx  small-sample-note.tsx
  lib/evidence/
    templates/telecom-sl.ts      # Dialog/Mobitel/Hutch + Dialog/SLT/Starlink template (§6)
    validation.ts                # Zod schemas for records, import rows, study setup
    window.ts                    # window calculation + out-of-window check
    import.ts                    # parse CSV/XLSX, map columns, validate, upsert by record_code
    qa-sample.ts                 # seeded stratified 20% sample + cited-record inclusion
    agreement.ts                 # coder vs checker agreement per field
    matrix.ts                    # theme matrix + denominators + threads + contributors
    targets.ts                   # progress vs targets, scarcity warnings
    duplicates.ts                # embedding similarity candidates
    guard.ts                     # proportionality wording guard
    appendix.ts                  # builds appendix data from study + screening + matrix
    *.test.ts                    # Vitest for every pure function above
  lib/ai/prompts/evidence-code.ts      # coding prompt
  lib/ai/prompts/evidence-findings.ts  # findings prompt
  lib/ai/schemas.ts                    # add EvidenceCodingSchema, EvidenceFindingsSchema
  inngest/functions/evidence-code-batch.ts
  inngest/functions/evidence-embed.ts
```

---

## 6. Study template: `telecom-sl`
Selecting this template in "New study" pre-fills setup (all editable):

- **Research questions → report section**
  1. What experiences explain or challenge the subject's weak value-for-money perception? → `value_perception`
  2. Why do users choose another operator for data or switch providers? → `multi_sim_moat`
  3. What trade-offs influence home-broadband choices between Dialog, SLT and Starlink? → `fixed_broadband`
- **Groups and entities**
  - Mobile: Dialog (subject), Mobitel, Hutch
  - Home broadband: Dialog Home Broadband / Air Fibre (subject), SLT Fibre, Starlink (`requires_geo_check`)
- **Themes** (key — label — investment relevance)
  - `price_value` — Price and value — pricing power and affordability
  - `network` — Network experience — perceived network differentiation
  - `billing_app` — Billing and app experience — customer-experience execution
  - `support` — Customer support — trust and retention
  - `switching` — Switching / multi-provider use — data-share retention and substitution
  - `install_availability` — Installation and availability — Air Fibre / SLT / Starlink positioning
- **Targets** (practical, not statistically representative)
  - Mobile self-care app reviews: 20 per entity (Google Play, product `app`) → 60
  - Broader mobile experiences: 20–30 (discussion platforms, group Mobile)
  - Home-broadband experiences: 15–30 (group Home broadband)
  - Overall guide: 95–120
- **Search-term structure** (same for every operator): `{operator} + value | speed | switching |
  customer service | home broadband`
- **Platform defaults:** Google Play + Reddit `selected`; Trustpilot, Facebook `pending` (Facebook
  note: "use only to fill the Sri Lankan Starlink gap"); Google Maps `excluded` with reason "branch
  experience is not a research question in this study".

Other sectors can get templates later (`banking-sl`, `retail-sl`); the template is plain data.

---

## 7. Behaviour

### 7.1 Import (`lib/evidence/import.ts`)
- Accepts `.csv` / `.xlsx`. Downloadable template columns match the team spreadsheet: Record ID,
  Platform, Source URL, Review/post date, Collection date, Thread ID, Contributor ref, Operator,
  Service/product, Relevant text or paraphrase, Language, Theme(s) (semicolon-separated keys or
  labels), Sentiment, Switching (Yes/No), Switching explanation, Included (Yes/No), Inclusion/exclusion note.
- Column-mapping step for differently named headers; preview of the first 20 rows with per-row errors.
- Validation per row: operator matches an entity; product valid; dates parse; posted_at inside the
  window (else auto-set `included=false`, `exclusion_reason=out_of_window`); `air_fibre` requires
  `product_evidence`; geo-checked entities require `geo_confirmed`; text contains no `@handles`,
  emails or phone numbers (strip and warn).
- Upsert by `record_code`; missing codes get the next `R###`. Rows with errors are skipped and
  reported, never half-imported. Writes one audit log entry per import.

### 7.2 AI-assisted coding (`inngest/functions/evidence-code-batch.ts`)
- Admin selects records → event `evidence/code.requested` → batches of 20, concurrency 2.
- Gemini Flash via `generateObject` with `EvidenceCodingSchema`:
  `{ themes: ThemeKey[], sentiment, switching: { value: boolean, explanation }, product_guess,
  product_evidence_quote | null, language, translation_en | null,
  flags: { advert, hearsay, not_first_hand, overseas, irrelevant }, confidence: 0..1 }`
- Prompt rules: only the study's theme keys; multiple themes allowed; `switching=true` only for an
  explicit change or a kept second connection; `air_fibre` only if the text names it; flag overseas
  when location cues point outside Sri Lanka; translate Sinhala/Tamil to English; never invent details.
- Result stored in `ai_suggestion`; status → `ai_suggested`. Nothing becomes `coded` until a person
  accepts or edits it on the Coding page (records `coded_by`).
- Records in languages the team marked as not interpretable are left `uncoded` and shown in limitations.

### 7.3 Duplicates and QA
- `evidence-embed` embeds each record's text (translation if present). `duplicates.ts` lists pairs
  with cosine similarity ≥ 0.92 in the same study as **candidates only**; an admin decides
  (mark duplicate → `exclusion_reason=duplicate`, `duplicate_of_id`) or dismisses.
- `qa-sample.ts`: deterministic seeded sample of `qa_rate` (20%) of coded, included records,
  stratified by entity (at least 2 per entity when available), plus **every record cited in any
  finding** (added automatically when cited). Sets `in_qa_sample`.
- QA page: checker sees the record and the coder's coding side by side, marks agree/disagree per
  field (themes, sentiment, switching, inclusion) and notes. `checked_by ≠ coded_by` is enforced.
  Disagreement → `disputed` until resolved. `agreement.ts` reports agreement % per field.
- A finding cannot be approved while any cited record is not `checked`.

### 7.4 Analysis (`lib/evidence/matrix.ts`)
- Input: included, coded records. Output per **comparison group → platform → product family**
  (app reviews kept apart from network/broadband) → entity:
  `n` (records), `threads` (distinct thread_id; a review with no thread counts as one), `contributors`
  (distinct contributor_ref; missing ref counts as unknown and is reported), and per theme:
  count, sentiment split (positive/mixed/negative/unclear), and % of n only when n ≥ `min_n_for_percent`.
- Switching panel: switching=true records by entity with their explanations listed.
- Warnings: entity below target; one thread supplying > 40% of an entity's contributions; Starlink
  (or any geo-checked entity) below target → automatic limitation text "smaller Sri Lankan sample".
- Each cell links to the filtered record list. No totals across entities, no star averages, no rankings.

### 7.5 Findings (`lib/ai/prompts/evidence-findings.ts`, `lib/evidence/guard.ts`)
- Per research question, "Draft findings" sends Gemini the theme matrix (with denominators) and the
  checked records' paraphrases. Output `EvidenceFindingsSchema`:
  `{ sentences: [{ text, support, cited_record_codes[] }] (max 3), caveats[] }`.
- Server validation: cited codes exist, are included and checked (else the finding stays draft with a
  warning); at most 3 sentences per question.
- `guard.ts` flags wording such as: "most / majority of customers", "customers are dissatisfied",
  "churn will", "market share", "will lose", percentages computed from a sample below threshold, and
  any number not present in the matrix. Warnings are stored in `guard_warnings` and must be resolved
  or acknowledged before approval.
- Admin edits and approves. Approving or rejecting writes an audit log and sends `company/pitch.refresh`.

### 7.6 Where findings appear (integration)
- **Pitch** (PLAN.md §4 step 7): the pitch prompt receives approved findings grouped by report
  section and may use at most the approved sentences, attributed as "exploratory customer-evidence
  study, {collection date}, n = …". `value_perception` and `multi_sim_moat` → Competitive
  positioning; `fixed_broadband` → Industry overview; `investment_risks` → Risks.
  `company/pitch.refresh` regenerates text only; prediction numbers and `inputs_hash` are unchanged.
- **Chatbot:** approved findings and checked public examples are added to the retrieval context with
  the same caveat; the bot must say this is an exploratory sample when citing them.
- **Public appendix** `/companies/[slug]/evidence` (linked from the "How we got here" tab):
  methodology (questions, platforms selected/excluded with reasons, window, search terms, sort
  method, languages), sample breakdown (records, threads, contributors per entity/platform), theme
  table, limitations (auto + admin text), and 3–5 paraphrased `public_example` records. No URLs to
  individual posts on the public page; no usernames anywhere.

---

## 8. Admin UX summary
- Study tabs: Overview · Setup · Screening · Records · Coding · QA · Analysis · Findings · Appendix.
- Overview shows the status stepper, targets progress bars per entity, open warnings (out-of-window,
  duplicates to review, disputed records, findings with guard warnings) and the suggested team split
  (mobile collector / broadband collector) with a 3–4 team-hour budget note.
- Roles: `analyst` can import, code and check; `admin` can also approve findings and publish the appendix.

---

## 9. Testing
- **Vitest** (pure functions): window boundaries; import row validation (air_fibre without evidence,
  geo-checked entity without geo_confirmed, PII stripping); QA sample size, stratification,
  determinism and cited-record inclusion; agreement maths; matrix denominators, thread/contributor
  counts and the percent threshold; guard phrase detection; Zod schemas rejecting unknown theme keys.
- **Guard test:** a test asserting `src/lib/valuation/**` and `recompute-company` import nothing from
  `lib/evidence` or `evidence_*` tables.
- **Playwright:** create a study from the `telecom-sl` template → import a sample XLSX (fixture in
  `tests/fixtures/evidence-sample.xlsx`, synthetic data only) → run AI coding (mocked Gemini) →
  accept suggestions → complete QA with a second admin → view matrix → draft, fix guard warning,
  approve a finding → see it on the public appendix and in the regenerated pitch.

---

## 10. Implementation tasks (in order)
| # | Task | Done when |
|---|---|---|
| E1 | Schema, enums, migration, `telecom-sl` template, seed one demo study with synthetic records | Migration applies on a clean DB; seed creates the demo study |
| E2 | Study setup + screening pages and server actions (auth, roles, audit log) | Template pre-fills; screening decisions with reasons save and show on Overview |
| E3 | Records table, single-record edit, CSV/XLSX import with mapping and validation, import template, CSV export | Sample file imports; invalid rows reported; out-of-window rows auto-excluded; export has no personal data |
| E4 | Embeddings + duplicate candidates; AI coding batch + Coding page | Suggestions appear as `ai_suggested`; accepting sets `coded`; duplicates reviewed manually |
| E5 | QA sampling, QA page, agreement stats, checker ≠ coder rule | 20% stratified sample selected; agreement % shown; disputed flow works |
| E6 | Analysis matrix, switching panel, targets progress and warnings | Denominators, threads and contributors shown; no % below threshold; groups and app vs network kept separate |
| E7 | Findings drafting, guard, approval flow | Max 3 sentences per question; uncited/unchecked or guarded findings cannot be approved without action |
| E8 | Public appendix page | Shows methodology, sample, theme table, limitations, examples; no usernames or post URLs |
| E9 | Integrations: pitch prompt input, `company/pitch.refresh`, chatbot context, valuation isolation test | Approved finding appears in the pitch section; prediction numbers unchanged |
| E10 | Tests from §9 and docs: add a "Customer evidence" note to `docs/PLAN.md` §5 and §9 | Lint, type-check, Vitest and Playwright pass |

---

## 11. Verification
1. `npx drizzle-kit migrate` and `npx tsx scripts/seed.ts` → demo study visible under the Dialog company.
2. Import the fixture → check counts, auto-exclusions and the error report.
3. Run coding (with `GOOGLE_GENERATIVE_AI_API_KEY`, or the mock) → accept a few, edit a few.
4. Log in as a second admin → complete QA → agreement % appears.
5. Analysis tab → Mobile and Home broadband shown separately; Starlink below target shows the
   smaller-sample limitation; no percentages for small n.
6. Draft findings → confirm the guard flags "most customers"; fix and approve.
7. Open `/companies/dialog/evidence` and the pitch page → the approved sentence appears with its
   caveat; the predicted prices and `inputs_hash` are the same as before.
8. `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, Playwright suite → all pass.
