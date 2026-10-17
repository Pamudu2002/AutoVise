import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { env } from "@/lib/env";

export interface LimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

const WINDOW_SECONDS = 3600;
let upstash: Map<number, Ratelimit> | null = null;

function upstashLimiter(limit: number): Ratelimit {
  upstash ??= new Map();
  let rl = upstash.get(limit);
  if (!rl) {
    rl = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(limit, "1 h"), prefix: "autovise:chat" });
    upstash.set(limit, rl);
  }
  return rl;
}

/** Fixed-window counter in Postgres, used when Upstash is not configured. */
async function dbLimit(key: string, limit: number): Promise<LimitResult> {
  const rows = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: new Date() })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < now() - interval '${sql.raw(String(WINDOW_SECONDS))} seconds' then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < now() - interval '${sql.raw(String(WINDOW_SECONDS))} seconds' then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });
  const row = rows[0];
  const elapsed = (Date.now() - new Date(row.windowStart).getTime()) / 1000;
  return { ok: row.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil(WINDOW_SECONDS - elapsed)) };
}

/** Checks every key against its limit (per IP and per chat session); all must pass. */
export async function checkLimits(checks: { key: string; limit: number }[]): Promise<LimitResult> {
  let worst: LimitResult = { ok: true, retryAfterSeconds: 0 };
  for (const c of checks) {
    let r: LimitResult;
    if (env.hasUpstash) {
      const res = await upstashLimiter(c.limit).limit(c.key);
      r = { ok: res.success, retryAfterSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
    } else {
      r = await dbLimit(c.key, c.limit);
    }
    if (!r.ok) worst = { ok: false, retryAfterSeconds: Math.max(worst.retryAfterSeconds, r.retryAfterSeconds) };
  }
  return worst;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}
