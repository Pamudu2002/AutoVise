# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Git and GitHub: hands off
- **Never run `git commit`, `git push`, `git merge`, `git rebase`, `git reset` or any other command that changes git history or the remote.**
- **Never create branches, pull requests, issues or comments on GitHub**, through the CLI or MCP tools.
- The project owner reviews and pushes all code manually. When work is done, list the changed files and suggest a commit message, but do not commit.
- Read-only git commands (`git status`, `git diff`, `git log`) are fine.

## Project
AutoVise automates an investment consultant's pitch. Visitors see company cards with the current
share price and a 3‑year predicted price; each company page explains how and why the prediction was
made and has a Q&A chatbot. Admins manage companies and upload financial reports (PDF/Excel). Every
upload, replacement or deletion re-extracts the data and recomputes that company's metrics,
prediction and pitch.

The full design is in **`docs/PLAN.md`**. Read it before starting a feature, follow its build
phases in order, and update it when a design decision changes.

## Stack
- Next.js 15 (App Router, TypeScript, Server Components and Server Actions), `src/` directory, `@/*` import alias
- Tailwind CSS v4, shadcn-style components in `src/components/ui`, Recharts, lucide-react
- Neon Postgres + pgvector, Drizzle ORM (`src/lib/db/schema.ts`), drizzle-kit migrations in `drizzle/`
- Auth.js v5: admin-only login (credentials + bcrypt). Visitors have no accounts
- Vercel Blob for report files, Inngest for background jobs (report processing, company recompute)
- Gemini through the Vercel AI SDK (`ai`, `@ai-sdk/google`): Flash for extraction and chat, Pro for the pitch, `gemini-embedding-001` at 768 dimensions
- Zod for all validation (forms, AI structured output, API input)
- Vitest for unit tests, Playwright for end-to-end tests

## Commands
```bash
npm run dev            # start the dev server
npm run build          # production build
npm run lint           # ESLint
npx tsc --noEmit       # type-check
npx vitest run         # unit tests
npx drizzle-kit generate   # create a migration after changing schema.ts
npm run db:migrate         # apply migrations (works for Neon/Postgres and pglite: URLs)
npm run db:seed            # seed the super-admin, sectors and sample companies (-- --reset to start over)
npm run test:e2e           # Playwright end-to-end tests (needs a seeded database)
```
Before calling a task done, run lint, type-check and the tests, and say what passed or failed.

## Environment
Copy `.env.example` to `.env.local`. Never commit secrets or print their values.
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `GOOGLE_GENERATIVE_AI_API_KEY`,
`BLOB_READ_WRITE_TOKEN`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
For local work a plain Postgres 16 with the `vector` extension works as well as Neon.

## Architecture rules
- **Prices come from code, not the LLM.** The valuation engine in `src/lib/valuation/` is made of pure,
  deterministic, unit-tested functions. Gemini only scores qualitative factors (−1..+1, with evidence)
  and writes the pitch text from computed numbers. Qualitative scores adjust growth and P/E only within
  the caps stored in `settings`. Any change to the engine needs tests.
- **Report versioning.** Replacing a file creates a new `report_versions` row and marks the old one
  `superseded`. Queries read only current, non-deleted versions. Every upload, replace or delete sends
  the `company/recompute` Inngest event (debounced per company). Jobs check that their version is
  still current before writing.
- **Explainability.** Each prediction stores its assumptions, factor scores, valuation breakdown
  (waterfall), `inputs_hash` and citations, so the public "how we got here" page can show every step.
  Old predictions are kept (archived) for the track record.
- **Predictions are drafts** until an admin publishes them, unless auto-publish is on in settings.
- **Chatbot** answers only from the company's data: metrics, published prediction, and retrieved report
  chunks. It cites sources, says when data is missing, never gives personal financial advice, and
  is rate limited.
- Validate AI output with Zod schemas in `src/lib/ai/schemas.ts`; keep prompts in `src/lib/ai/prompts/`.
- Keep Gemini calls server-side only. Never expose API keys to the client.

## Code conventions
- Server Components by default; add `"use client"` only for interactivity (charts, forms, chat, simulator).
- Mutations go through Server Actions or route handlers that check the admin session and role, then
  write to `audit_logs`.
- After changing company data, call `revalidateTag` / `revalidatePath` for that company.
- Store money as numbers with an explicit currency, and financial statement figures normalised by `unit_multiplier`.
- Keep files small and named after what they do; follow the folder layout in `docs/PLAN.md` §7.
- Match the existing code style; don't add libraries the plan does not mention without saying why.
- Show the investment disclaimer on every public page that shows a prediction.
