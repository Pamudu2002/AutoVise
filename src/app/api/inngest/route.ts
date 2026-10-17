import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processReport } from "@/inngest/functions/process-report";
import { recomputeCompanyFn } from "@/inngest/functions/recompute-company";

// Report extraction with Gemini can take a few minutes on large PDFs.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processReport, recomputeCompanyFn],
});
