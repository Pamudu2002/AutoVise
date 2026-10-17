import { markVersionFailed, processReportVersion } from "@/lib/pipeline/process";
import type { Step } from "@/lib/jobs/step";
import { EVENTS, inngest, type ReportUploadedData } from "../client";

/** One run per uploaded file version: parse → extract → chunk + embed → review (or auto-approve). */
export const processReport = inngest.createFunction(
  {
    id: "process-report",
    name: "Process report version",
    retries: 3,
    concurrency: { limit: 4 },
    triggers: [{ event: EVENTS.reportUploaded }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: Partial<ReportUploadedData> } }).event?.data;
      if (data?.versionId) await markVersionFailed(data.versionId, error.message);
    },
  },
  async ({ event, step }) => {
    const data = event.data as ReportUploadedData;
    const run: Step = (name, fn) => step.run(name, fn) as never;
    const result = await processReportVersion(data.versionId, run);
    if (!result.skipped && result.approved) {
      await step.sendEvent("recompute", {
        name: EVENTS.recompute,
        data: { companyId: result.companyId, trigger: `${result.title} approved automatically` },
      });
    }
    return result;
  },
);
