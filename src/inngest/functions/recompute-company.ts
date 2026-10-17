import type { Step } from "@/lib/jobs/step";
import { recomputeCompany } from "@/lib/predictions/recompute";
import { EVENTS, inngest, type RecomputeData } from "../client";

/**
 * Rebuilds a company's metrics, prediction and pitch. Debounced per company, so several uploads,
 * approvals or deletions in quick succession trigger a single recompute.
 */
export const recomputeCompanyFn = inngest.createFunction(
  {
    id: "recompute-company",
    name: "Recompute company prediction",
    retries: 2,
    debounce: { key: "event.data.companyId", period: "30s" },
    concurrency: { limit: 1, key: "event.data.companyId" },
    triggers: [{ event: EVENTS.recompute }],
  },
  async ({ event, step }) => {
    const data = event.data as RecomputeData;
    const run: Step = (name, fn) => step.run(name, fn) as never;
    return recomputeCompany(data.companyId, { trigger: data.trigger, force: data.force, step: run });
  },
);
