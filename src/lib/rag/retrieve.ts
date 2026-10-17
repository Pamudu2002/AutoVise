import "server-only";
import { and, cosineDistance, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialReports, reportChunks, reportVersions } from "@/lib/db/schema";
import { embedQuery } from "@/lib/pipeline/embed";

export interface RetrievedChunk {
  id: string;
  content: string;
  page: number | null;
  reportId: string;
  reportVersionId: string;
  versionNo: number;
  title: string;
}

/** Words for an OR full-text query; keeps only safe tokens. */
export function ftsQuery(text: string): string | null {
  const words = [...new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].slice(0, 12);
  return words.length ? words.join(" | ") : null;
}

/** Reciprocal rank fusion of several ranked lists. */
export function fuse<T extends { id: string }>(lists: T[][], k = 60): T[] {
  const score = new Map<string, { item: T; s: number }>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const cur = score.get(item.id) ?? { item, s: 0 };
      cur.s += 1 / (k + rank + 1);
      score.set(item.id, cur);
    });
  }
  return [...score.values()].sort((a, b) => b.s - a.s).map((x) => x.item);
}

/**
 * Hybrid search over a company's report chunks: pgvector cosine similarity plus Postgres full-text
 * search, fused by rank. Only chunks from current, approved, non-deleted report versions are used.
 */
export async function retrieveChunks(companyId: string, query: string, k = 8): Promise<RetrievedChunk[]> {
  const select = {
    id: reportChunks.id,
    content: reportChunks.content,
    page: reportChunks.page,
    reportId: financialReports.id,
    reportVersionId: reportChunks.reportVersionId,
    versionNo: reportVersions.versionNo,
    title: financialReports.title,
  };
  const scope = and(eq(reportChunks.companyId, companyId), isNull(financialReports.deletedAt), eq(reportVersions.status, "approved"));
  const base = () =>
    db
      .select(select)
      .from(reportChunks)
      .innerJoin(financialReports, eq(financialReports.currentVersionId, reportChunks.reportVersionId))
      .innerJoin(reportVersions, eq(reportVersions.id, reportChunks.reportVersionId));

  const lists: RetrievedChunk[][] = [];
  const embedding = await embedQuery(query);
  if (embedding) {
    lists.push(
      await base()
        .where(and(scope, isNotNull(reportChunks.embedding)))
        .orderBy(cosineDistance(reportChunks.embedding, embedding))
        .limit(20),
    );
  }
  const q = ftsQuery(query);
  if (q) {
    const tsq = sql`to_tsquery('english', ${q})`;
    lists.push(
      await base()
        .where(and(scope, sql`${reportChunks.tsv} @@ ${tsq}`))
        .orderBy(desc(sql`ts_rank(${reportChunks.tsv}, ${tsq})`))
        .limit(20),
    );
  }
  return fuse(lists).slice(0, k);
}
