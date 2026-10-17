import type { Citation } from "@/lib/ai/schemas";
import type { CompanyInputs, InsightInput } from "./inputs";
import { reportLabel } from "./inputs";

const IMPACT_RANK = { high: 3, med: 2, low: 1 } as const;

export interface SourceList {
  /** Text block for prompts: one line per source, "S1: [label] summary — "quote"". */
  text: string;
  citations: Citation[];
  /** Source id for each insight id. */
  byInsight: Map<string, string>;
}

/**
 * Numbers the evidence for prompts (S1, S2…) so the model can cite by id and we can map ids back to
 * a report, version and page. Highest-impact insights first; capped to keep prompts small.
 */
export function buildSources(inputs: CompanyInputs, limit = 40): SourceList {
  const reports = new Map(inputs.reports.map((r) => [r.versionId, r]));
  const insights = [...inputs.insights]
    .sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] || Math.abs(b.sentiment) - Math.abs(a.sentiment))
    .slice(0, limit);

  const citations: Citation[] = [];
  const lines: string[] = [];
  const byInsight = new Map<string, string>();

  insights.forEach((ins: InsightInput) => {
    const id = `S${citations.length + 1}`;
    const r = reports.get(ins.reportVersionId);
    const label = r ? reportLabel(r, ins.page) : "Company report";
    citations.push({
      id,
      label,
      reportId: r?.reportId ?? null,
      reportVersionId: ins.reportVersionId,
      versionNo: r?.versionNo ?? null,
      page: ins.page,
      quote: ins.evidenceQuote,
      section: ins.category,
    });
    byInsight.set(ins.id, id);
    const sent = (ins.sentiment >= 0 ? "+" : "−") + Math.abs(ins.sentiment).toFixed(1);
    lines.push(`${id}: [${label}] (${ins.category}, sentiment ${sent}, impact ${ins.impact}) ${ins.summary}${ins.evidenceQuote ? ` — "${ins.evidenceQuote}"` : ""}`);
  });

  for (const ev of inputs.events.slice(0, 10)) {
    const id = `S${citations.length + 1}`;
    citations.push({ id, label: `Company news, ${ev.date}`, reportId: null, reportVersionId: null, versionNo: null, page: null, quote: ev.body ?? ev.title, section: "event" });
    lines.push(`${id}: [Company news, ${ev.date}] ${ev.title}${ev.body ? ` — ${ev.body}` : ""}`);
  }

  return { text: lines.join("\n") || "(no qualitative sources available)", citations, byInsight };
}
