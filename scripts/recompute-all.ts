/**
 * Recomputes every company's prediction (as drafts, or published if auto-publish allows), e.g. after
 * a valuation engine change.
 *   npm run recompute            # only companies whose inputs changed
 *   npm run recompute -- --force # rebuild all
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const force = process.argv.includes("--force");
  const { asc } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { companies } = await import("@/lib/db/schema");
  const { recomputeCompany } = await import("@/lib/predictions/recompute");
  const all = await db.select({ id: companies.id, ticker: companies.ticker }).from(companies).orderBy(asc(companies.ticker));
  for (const c of all) {
    const res = await recomputeCompany(c.id, { trigger: "Valuation engine updated", force });
    const msg =
      res.status === "created" ? `draft v${res.version}${res.published ? " (auto-published)" : ""}` : res.status === "insufficient" ? `skipped: ${res.reason}` : res.status;
    console.log(`  ${c.ticker.padEnd(6)} ${msg}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
