import type { EntityLite, GroupLite, RecordLite, TargetLite } from "./types";

/** Collection progress against practical (not statistically representative) targets (PLAN2 §6). */

export interface TargetRow {
  entityId: string | null;
  label: string;
  count: number;
  min: number;
  max: number;
  status: "below" | "within" | "above";
}

export interface TargetProgress {
  targetId: string;
  label: string;
  perEntity: boolean;
  rows: TargetRow[];
}

const status = (count: number, min: number, max: number): TargetRow["status"] => (count < min ? "below" : count > max ? "above" : "within");

function matches(r: RecordLite, t: TargetLite, entity: EntityLite | undefined) {
  if (!r.included || !entity) return false;
  if (t.groupId && entity.groupId !== t.groupId) return false;
  if (t.product && r.product !== t.product) return false;
  if (t.platform && r.platform !== t.platform) return false;
  return true;
}

export function targetProgress(targets: TargetLite[], records: RecordLite[], entities: EntityLite[]): TargetProgress[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return targets.map((t) => {
    const hits = records.filter((r) => matches(r, t, byId.get(r.entityId)));
    if (!t.perEntity) {
      return { targetId: t.id, label: t.label, perEntity: false, rows: [{ entityId: null, label: t.label, count: hits.length, min: t.targetMin, max: t.targetMax, status: status(hits.length, t.targetMin, t.targetMax) }] };
    }
    const scope = entities.filter((e) => !t.groupId || e.groupId === t.groupId);
    return {
      targetId: t.id,
      label: t.label,
      perEntity: true,
      rows: scope.map((e) => {
        const count = hits.filter((r) => r.entityId === e.id).length;
        return { entityId: e.id, label: e.name, count, min: t.targetMin, max: t.targetMax, status: status(count, t.targetMin, t.targetMax) };
      }),
    };
  });
}

/**
 * Warnings for the Overview, and automatic limitation text for the appendix. An entity that needs a
 * location check (e.g. Starlink) and falls short of its share of a group target gets the
 * "smaller Sri Lankan sample" limitation.
 */
export function targetWarnings(input: { targets: TargetLite[]; progress: TargetProgress[]; records: RecordLite[]; entities: EntityLite[]; groups: GroupLite[] }): {
  warnings: string[];
  limitations: string[];
} {
  const warnings: string[] = [];
  const limitations: string[] = [];
  const included = input.records.filter((r) => r.included);

  for (const p of input.progress) {
    for (const row of p.rows) {
      if (row.status === "below") warnings.push(`${p.perEntity ? `${row.label} — ` : ""}${p.label}: ${row.count} of a minimum of ${row.min}.`);
    }
  }

  for (const e of input.entities.filter((x) => x.requiresGeoCheck)) {
    const groupTargets = input.targets.filter((t) => t.groupId === e.groupId);
    const count = included.filter((r) => r.entityId === e.id).length;
    const groupSize = input.entities.filter((x) => x.groupId === e.groupId).length || 1;
    const share = groupTargets.reduce((best, t) => Math.max(best, t.perEntity ? t.targetMin : Math.ceil(t.targetMin / groupSize)), 0);
    if (share > 0 && count < share) {
      warnings.push(`${e.name}: ${count} Sri Lankan records against a share of ${share}.`);
      limitations.push(`${e.name}: smaller Sri Lankan sample (${count} records against a planned ${share}); its patterns are especially tentative.`);
    }
  }
  return { warnings, limitations };
}
