import { extractNumbers } from "@/lib/ai/grounding";

/**
 * Proportionality guard for findings (PLAN2 §7.5). An exploratory sample cannot support claims about
 * "most customers", churn, market share or threat size, and percentages need a large enough base.
 */
export interface GuardWarning {
  code: "majority_claim" | "blanket_sentiment" | "churn_prediction" | "market_share" | "loss_prediction" | "small_sample_percent" | "number_not_in_matrix" | "citation";
  message: string;
  phrase: string;
  acknowledged?: boolean;
}

const RULES: { code: GuardWarning["code"]; re: RegExp; message: string }[] = [
  {
    code: "majority_claim",
    re: /\b(most|majority of|the majority|nearly all|almost all|all|every|the typical|many)\s+(of\s+the\s+)?(customers|users|subscribers|consumers|people|reviewers)\b/i,
    message: "Claims about the share of all customers cannot be made from an exploratory sample. Describe what the records show instead.",
  },
  {
    code: "blanket_sentiment",
    re: /\b(customers|users|subscribers|consumers)\s+(are|were|feel|remain)\s+(dissatisfied|unhappy|frustrated|satisfied|happy|loyal|angry)\b/i,
    message: "Avoid blanket statements about how customers feel; say what the reviewed accounts describe.",
  },
  { code: "churn_prediction", re: /\bchurn\s+(will|is\s+(going|likely)\s+to|could\s+reach|of\s+\d)|\b\d+(\.\d+)?\s*%\s+churn\b/i, message: "The study cannot predict churn or its size." },
  { code: "market_share", re: /\bmarket\s+share\b/i, message: "The study cannot say anything about market share." },
  { code: "loss_prediction", re: /\b(will|is\s+going\s+to|set\s+to)\s+(lose|shed|bleed)\b/i, message: "The study cannot predict losses or threat size." },
];

/**
 * @param allowedNumbers counts, n, threads and contributors present in the theme matrix
 * @param allowedPercents percentages the matrix itself shows (only for n ≥ the small-sample threshold)
 */
export function guardFinding(text: string, ctx: { allowedNumbers: number[]; allowedPercents: number[] }): GuardWarning[] {
  const out: GuardWarning[] = [];
  for (const r of RULES) {
    const m = text.match(r.re);
    if (m) out.push({ code: r.code, message: r.message, phrase: m[0] });
  }
  for (const n of extractNumbers(text)) {
    const at = text.indexOf(n.raw);
    const isPercent = /^\s*(%|per\s*cent|percent)/i.test(text.slice(at + n.raw.length, at + n.raw.length + 9));
    const v = Math.abs(n.value);
    if (n.decimals === 0 && v >= 1990 && v <= 2100 && !isPercent) continue; // years
    const tol = 0.5 * 10 ** -n.decimals + 1e-9;
    const pool = isPercent ? ctx.allowedPercents : ctx.allowedNumbers;
    if (pool.some((a) => Math.abs(a - v) <= tol)) continue;
    out.push(
      isPercent
        ? { code: "small_sample_percent", message: "Percentages are only allowed where the matrix shows them (n at or above the small-sample threshold).", phrase: n.raw + "%" }
        : { code: "number_not_in_matrix", message: "This number does not appear in the theme matrix.", phrase: n.raw },
    );
  }
  return out;
}

/** A finding can be approved only when every warning has been fixed or acknowledged. */
export const unresolved = (warnings: GuardWarning[]) => warnings.filter((w) => !w.acknowledged);
