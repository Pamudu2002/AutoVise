/**
 * Second-person check sample (PLAN2 §7.3): a deterministic, seeded share (`rate`, 20 % by default) of
 * coded, included records, stratified by entity with at least `minPerEntity` per entity when
 * available, plus every record cited in a finding and every record already checked.
 */

export interface QaCandidate {
  id: string;
  recordCode: string;
  entityId: string;
  included: boolean;
  codingStatus: string;
}

/** FNV-1a 32-bit hash, so the same seed always picks the same records. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const QA_ELIGIBLE = new Set(["coded", "checked", "disputed"]);

export function selectQaSample(
  records: QaCandidate[],
  opts: { rate: number; seed: string; minPerEntity?: number; cited?: Iterable<string>; keep?: Iterable<string> },
): Set<string> {
  const minPer = opts.minPerEntity ?? 2;
  const eligible = records.filter((r) => r.included && QA_ELIGIBLE.has(r.codingStatus));
  const byEntity = new Map<string, QaCandidate[]>();
  for (const r of eligible) byEntity.set(r.entityId, [...(byEntity.get(r.entityId) ?? []), r]);

  const out = new Set<string>();
  for (const [, list] of [...byEntity.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ordered = [...list].sort((a, b) => hash(opts.seed + a.recordCode) - hash(opts.seed + b.recordCode) || a.recordCode.localeCompare(b.recordCode));
    const quota = Math.min(list.length, Math.max(minPer, Math.round(list.length * opts.rate)));
    ordered.slice(0, quota).forEach((r) => out.add(r.id));
  }
  for (const id of opts.cited ?? []) out.add(id);
  for (const id of opts.keep ?? []) out.add(id);
  return out;
}
