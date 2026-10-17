# AutoVise

AutoVise automates an investment consultant's pitch. Visitors browse company cards with the current
share price and a 3-year predicted price; each company page explains how and why the prediction was
made and has a Q&A chatbot. Admins manage companies and upload financial reports (PDF/Excel); every
upload, replacement or deletion re-extracts the data and recomputes that company's figures,
prediction and pitch.

- Design and build plan: [`docs/PLAN.md`](docs/PLAN.md)
- UI design handoff: [`design/autovise-design`](design/autovise-design)
- Working rules for Claude Code: [`CLAUDE.md`](CLAUDE.md)

## Quick start (local, no external services)

```bash
npm install
cp .env.example .env.local          # then set AUTH_SECRET and SEED_ADMIN_PASSWORD
npm run db:migrate                  # creates an embedded PGlite database in .data/pglite
npm run db:seed                     # sample companies, reports, prices and predictions
npm run dev                         # http://localhost:3000  ·  admin at /admin/login
```

`DATABASE_URL=pglite:./.data/pglite` runs Postgres (with pgvector) inside the Node process — stop
`npm run dev` before running the seed or migrations, since only one process can open it. For Neon or
any Postgres 16 with the `vector` extension, set a normal `postgres://` URL instead.

Without the optional keys the app still works end to end:

| Service | Configured | Not configured (local fallback) |
|---|---|---|
| Gemini (`GOOGLE_GENERATIVE_AI_API_KEY`) | Extracts figures and insights, scores factors, writes the pitch, powers the chat | Figures are entered on the review screen; factor scores and the pitch come from deterministic code; chat shows as offline |
| Vercel Blob (`BLOB_READ_WRITE_TOKEN`) | Direct browser uploads to Blob | Files stored in `.data/uploads`, served by `/api/files` |
| Inngest (`INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`, or `INNGEST_DEV=1`) | Retries, per-company debounce | Jobs run in-process after the response |
| Upstash (`UPSTASH_REDIS_REST_URL`/`TOKEN`) | Sliding-window chat rate limit | Postgres fixed-window counter |

Seed with Gemini as well (factor scores, pitches and embeddings): `npm run db:seed -- --reset --with-ai`.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests (valuation engine, grounding, parsing)
npm run test:e2e     # Playwright: admin flow → publish → public pitch (needs a seeded DB)
npm run db:generate  # drizzle-kit generate after editing src/lib/db/schema.ts
npm run db:migrate   # apply migrations (Neon/Postgres or pglite)
npm run db:seed      # seed data (add -- --reset to wipe and reseed)
npm run inngest:dev  # local Inngest dev server (set INNGEST_DEV=1)
npm run ai:check     # verify the Gemini key, models and 768-dim embeddings
npm run ai:embed     # embed report chunks stored before Gemini was configured
```

## How a prediction is made

1. **Upload** — reports go to Blob storage; a `report_version` is created (replacements supersede the
   previous version). `report/version.uploaded` starts **process-report**: parse (unpdf / SheetJS),
   Gemini structured extraction (Zod-validated), chunk + embed into `report_chunks` (pgvector + full-text).
2. **Review** — an analyst checks figures against the PDF, edits or adds values, includes or excludes
   insights, and approves. Approval (or any upload/replace/delete) sends `company/recompute`
   (debounced 30 s per company).
3. **Recompute** — `src/lib/predictions/recompute.ts` loads the current approved data, scores the six
   qualitative factors, runs the deterministic engine in `src/lib/valuation/` (ratios → blended,
   mean-reverting EPS growth → exit P/E → dividend cross-check → capped qualitative overlay →
   bear/base/bull → confidence and AutoVise Score → waterfall), writes a grounded pitch, and saves a
   draft prediction with its `inputs_hash`.
4. **Publish** — an admin compares the draft with the published version and publishes it (or
   auto-publish handles small changes). Earlier predictions are archived for the track record.

## Deploying (Vercel + Neon + Inngest)

1. Create a Neon database (the first migration runs `CREATE EXTENSION IF NOT EXISTS vector`).
2. Set the environment variables from `.env.example` in Vercel (Blob token from a Vercel Blob store,
   Inngest keys from the Inngest Vercel integration, Upstash keys for the rate limit).
3. Run `npm run db:migrate` and `npm run db:seed` against the Neon URL once (or create the first
   super-admin with the seed and delete the sample companies).
4. Point Inngest at `https://<your-domain>/api/inngest`.
