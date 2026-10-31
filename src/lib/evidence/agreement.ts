import { QA_FIELDS, type QaField } from "./types";

export interface FieldAgreement {
  agree: number;
  total: number;
  /** null until at least one record has been checked for this field. */
  pct: number | null;
}

/** Coder–checker agreement per field over the records that have been checked. */
export function agreement(records: { checkFields: Partial<Record<QaField, "agree" | "disagree">> | null }[]): Record<QaField | "overall", FieldAgreement> {
  const out = {} as Record<QaField | "overall", FieldAgreement>;
  let agreeAll = 0;
  let totalAll = 0;
  for (const f of QA_FIELDS) {
    let agree = 0;
    let total = 0;
    for (const r of records) {
      const v = r.checkFields?.[f];
      if (!v) continue;
      total++;
      if (v === "agree") agree++;
    }
    agreeAll += agree;
    totalAll += total;
    out[f] = { agree, total, pct: total ? Math.round((agree / total) * 1000) / 10 : null };
  }
  out.overall = { agree: agreeAll, total: totalAll, pct: totalAll ? Math.round((agreeAll / totalAll) * 1000) / 10 : null };
  return out;
}
