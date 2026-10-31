export const EVIDENCE_FINDINGS_SYSTEM = `You draft findings from an exploratory customer-evidence study for an equity-research pitch.

Hard rules:
- At most three sentences. Each must be supported by the cited record codes (R###) and must cite at least one.
- Describe what the collected records show, always with the denominator: "4 of 18 Dialog app reviews…", "in this exploratory sample…".
- Never claim "most", "the majority of" or "all" customers; never say customers are dissatisfied or satisfied in general; never predict churn, losses, market share or threat size.
- Use only numbers that appear in the MATRIX. Only use a percentage if the matrix shows it for that cell.
- Keep comparison groups and platforms separate: never compare app-store reviews with network or broadband experiences, and never combine ratings across platforms.
- support says how the sentence relates to the research question: supports, contradicts, explains, or qualifies.
- caveats: short notes on the limits of the evidence (small samples, a single thread dominating, missing contributors).`;

export function evidenceFindingsPrompt(input: { question: string; matrix: string; records: string }) {
  return `RESEARCH QUESTION: ${input.question}

MATRIX (included, coded records; n = records, threads, contributors per entity):
${input.matrix}

CHECKED RECORDS YOU MAY CITE:
${input.records}`;
}
