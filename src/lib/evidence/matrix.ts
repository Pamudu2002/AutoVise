import { productFamily, SENTIMENTS, type EntityLite, type GroupLite, type Platform, type ProductFamily, type RecordLite, type Sentiment, type ThemeLite } from "./types";

/**
 * Theme matrix (PLAN2 §7.4). Kept apart by comparison group → platform → product family (app reviews
 * vs service experiences) → entity. Every count carries its denominator, thread and contributor
 * counts. Percentages only where n ≥ the small-sample threshold. No totals across entities, no star
 * averages, no rankings.
 */

export interface MatrixCell {
  count: number;
  sentiment: Record<Sentiment, number>;
  /** Share of n, only when n ≥ minNForPercent. */
  pct: number | null;
}

export interface EntityColumn {
  entityId: string;
  entityName: string;
  isSubject: boolean;
  n: number;
  threads: number;
  contributors: number;
  /** Records without a contributor ref — reported, not guessed. */
  unknownContributors: number;
  /** Largest share of n coming from one thread (0..1). */
  topThreadShare: number;
  topThreadId: string | null;
  cells: Record<string, MatrixCell>;
}

export interface MatrixBlock {
  groupId: string;
  groupName: string;
  platform: Platform;
  family: ProductFamily;
  entities: EntityColumn[];
}

export interface SwitchingEntry {
  entityId: string;
  entityName: string;
  records: { recordCode: string; note: string | null }[];
}

export interface Matrix {
  blocks: MatrixBlock[];
  switching: SwitchingEntry[];
  /** Records left out of the matrix because their coding is disputed or not done. */
  pendingCoding: number;
  minNForPercent: number;
}

const ANALYSED = new Set(["coded", "checked"]);

/** Records that count: included and coded (disputed records wait until resolved). */
export const analysable = (r: RecordLite) => r.included && ANALYSED.has(r.codingStatus);

const emptySentiment = (): Record<Sentiment, number> => ({ positive: 0, mixed: 0, negative: 0, unclear: 0 });

export function sampleCounts(records: RecordLite[]) {
  const threadIds = new Set<string>();
  let noThread = 0;
  const refs = new Set<string>();
  let unknown = 0;
  const perThread = new Map<string, number>();
  for (const r of records) {
    if (r.threadId) {
      threadIds.add(r.threadId);
      perThread.set(r.threadId, (perThread.get(r.threadId) ?? 0) + 1);
    } else noThread++;
    if (r.contributorRef) refs.add(r.contributorRef);
    else unknown++;
  }
  let topThreadId: string | null = null;
  let top = 0;
  for (const [id, c] of perThread) {
    if (c > top) {
      top = c;
      topThreadId = id;
    }
  }
  return {
    n: records.length,
    threads: threadIds.size + noThread,
    contributors: refs.size,
    unknownContributors: unknown,
    topThreadShare: records.length ? top / records.length : 0,
    topThreadId,
  };
}

export function buildMatrix(input: { records: RecordLite[]; entities: EntityLite[]; groups: GroupLite[]; themes: ThemeLite[]; minNForPercent: number }): Matrix {
  const { entities, groups, themes, minNForPercent } = input;
  const usable = input.records.filter(analysable);
  const byEntity = new Map(entities.map((e) => [e.id, e]));
  const blocks: MatrixBlock[] = [];

  for (const g of groups) {
    const groupEntities = entities.filter((e) => e.groupId === g.id);
    const inGroup = usable.filter((r) => byEntity.get(r.entityId)?.groupId === g.id);
    const keys = [...new Set(inGroup.map((r) => `${r.platform}|${productFamily(r.product)}`))].sort();
    for (const key of keys) {
      const [platform, family] = key.split("|") as [Platform, ProductFamily];
      const subset = inGroup.filter((r) => r.platform === platform && productFamily(r.product) === family);
      const columns: EntityColumn[] = groupEntities.map((e) => {
        const rs = subset.filter((r) => r.entityId === e.id);
        const s = sampleCounts(rs);
        const cells: Record<string, MatrixCell> = {};
        for (const t of themes) {
          const withTheme = rs.filter((r) => r.themeKeys.includes(t.key));
          const sentiment = emptySentiment();
          for (const r of withTheme) sentiment[r.sentiment ?? "unclear"]++;
          cells[t.key] = {
            count: withTheme.length,
            sentiment,
            pct: s.n >= minNForPercent && s.n > 0 ? Math.round((withTheme.length / s.n) * 1000) / 10 : null,
          };
        }
        return { entityId: e.id, entityName: e.name, isSubject: e.isSubject, ...s, cells };
      });
      blocks.push({ groupId: g.id, groupName: g.name, platform, family, entities: columns });
    }
  }

  const switching: SwitchingEntry[] = entities
    .map((e) => ({
      entityId: e.id,
      entityName: e.name,
      records: usable.filter((r) => r.entityId === e.id && r.switching).map((r) => ({ recordCode: r.recordCode, note: r.switchingNote })),
    }))
    .filter((s) => s.records.length > 0);

  const pendingCoding = input.records.filter((r) => r.included && !ANALYSED.has(r.codingStatus)).length;
  return { blocks, switching, pendingCoding, minNForPercent };
}

/** Thread dominance: one thread supplying more than 40 % of an entity's records in a block. */
export function matrixWarnings(m: Matrix): string[] {
  const out: string[] = [];
  for (const b of m.blocks) {
    for (const e of b.entities) {
      if (e.n >= 3 && e.topThreadShare > 0.4) {
        out.push(`${e.entityName} (${b.groupName}, ${b.platform.replace("_", " ")}): one thread (${e.topThreadId}) supplies ${e.n ? Math.round(e.topThreadShare * e.n) : 0} of ${e.n} records.`);
      }
      if (e.unknownContributors > 0) out.push(`${e.entityName} (${b.groupName}, ${b.platform.replace("_", " ")}): ${e.unknownContributors} of ${e.n} records have no contributor ref.`);
    }
  }
  return out;
}

/** Every number a finding may quote: counts, sentiment splits, n, threads, contributors; and the shown percentages. */
export function allowedNumbers(m: Matrix): { numbers: number[]; percents: number[] } {
  const numbers = new Set<number>();
  const percents = new Set<number>();
  for (const b of m.blocks) {
    for (const e of b.entities) {
      [e.n, e.threads, e.contributors, e.unknownContributors].forEach((v) => numbers.add(v));
      for (const c of Object.values(e.cells)) {
        numbers.add(c.count);
        SENTIMENTS.forEach((s) => numbers.add(c.sentiment[s]));
        if (c.pct !== null) percents.add(c.pct);
      }
    }
  }
  for (const s of m.switching) numbers.add(s.records.length);
  return { numbers: [...numbers], percents: [...percents] };
}
