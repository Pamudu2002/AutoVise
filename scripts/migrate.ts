/**
 * Applies the migrations in ./drizzle. Works for Neon/Postgres URLs and for local `pglite:` URLs.
 *   npm run db:migrate
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { vector } = await import("@electric-sql/pglite/vector");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { mkdirSync } = await import("node:fs");
    const dir = url.slice("pglite:".length);
    if (dir) mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir || undefined, { extensions: { vector } });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.close();
  } else {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1, prepare: false });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
  }
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
