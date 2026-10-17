import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  // drizzle-kit migrate works for Neon and Postgres. For a pglite: URL use `npm run db:migrate`,
  // which loads the pgvector extension before applying the same migrations.
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
