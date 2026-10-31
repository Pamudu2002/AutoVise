import { refreshCompanyPitch } from "@/lib/evidence/pitch";
import { codeRecords, embedStudy } from "@/lib/evidence/service";
import { EVENTS, inngest, type EvidenceCodeData, type EvidenceEmbedData, type PitchRefreshData } from "../client";

/** AI-assisted coding for one batch of up to 20 records. Two batches at a time to stay inside Gemini limits. */
export const evidenceCodeBatch = inngest.createFunction(
  {
    id: "evidence-code-batch",
    name: "Customer evidence: AI-assisted coding",
    retries: 2,
    concurrency: { limit: 2 },
    triggers: [{ event: EVENTS.evidenceCode }],
  },
  async ({ event, step }) => {
    const data = event.data as EvidenceCodeData;
    return step.run("code-batch", () => codeRecords(data.studyId, data.recordIds));
  },
);

export const evidenceEmbed = inngest.createFunction(
  {
    id: "evidence-embed",
    name: "Customer evidence: embed records",
    retries: 2,
    debounce: { key: "event.data.studyId", period: "20s" },
    triggers: [{ event: EVENTS.evidenceEmbed }],
  },
  async ({ event, step }) => {
    const data = event.data as EvidenceEmbedData;
    return step.run("embed", () => embedStudy(data.studyId));
  },
);

/** Re-attaches approved findings to the draft and published pitches. Text only; no numbers change. */
export const pitchRefresh = inngest.createFunction(
  {
    id: "pitch-refresh",
    name: "Refresh pitch customer evidence",
    retries: 2,
    debounce: { key: "event.data.companyId", period: "10s" },
    triggers: [{ event: EVENTS.pitchRefresh }],
  },
  async ({ event, step }) => {
    const data = event.data as PitchRefreshData;
    return step.run("refresh", () => refreshCompanyPitch(data.companyId));
  },
);
