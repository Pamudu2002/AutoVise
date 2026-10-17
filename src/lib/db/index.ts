import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

/**
 * DATABASE_URL may point at Neon or any Postgres 16 with pgvector (postgres-js driver),
 * or at an embedded PGlite database with `pglite:./.data/pglite` for zero-setup local work.
 */
function create(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");

  if (url.startsWith("pglite:")) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { PGlite } = require("@electric-sql/pglite");
    const { vector } = require("@electric-sql/pglite/vector");
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite");
    /* eslint-enable @typescript-eslint/no-require-imports */
    const client = new PGlite(url.slice("pglite:".length) || undefined, { extensions: { vector } });
    // Same query-builder API; the types differ only in driver internals.
    return drizzlePglite(client, { schema }) as unknown as DB;
  }

  const client = postgres(url, { max: process.env.NODE_ENV === "production" ? 5 : 3, prepare: false });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as { __autoviseDb?: DB };

export function getDb(): DB {
  if (!globalForDb.__autoviseDb) globalForDb.__autoviseDb = create();
  return globalForDb.__autoviseDb;
}

/** Lazily connects on first use, so importing this module never needs a database (e.g. at build time). */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
