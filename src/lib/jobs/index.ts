import "server-only";
import { after } from "next/server";
import { EVENTS, inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { markVersionFailed, processReportVersion } from "@/lib/pipeline/process";
import { recomputeCompany } from "@/lib/predictions/recompute";

/**
 * Job dispatch. With Inngest configured, events go to Inngest (retries, per-company debounce).
 * Without it, the same functions run in-process after the response is sent, and recomputes for a
 * company are coalesced so a burst of changes triggers one rebuild.
 */

function runLater(task: () => Promise<unknown>) {
  const safe = () => task().catch((err) => console.error("[jobs] background task failed:", err));
  try {
    after(safe);
  } catch {
    // Outside a request (scripts): run now without awaiting.
    void safe();
  }
}

export async function sendReportUploaded(versionId: string, companyId: string) {
  if (env.hasInngest) {
    await inngest.send({ name: EVENTS.reportUploaded, data: { versionId, companyId } });
    return;
  }
  runLater(async () => {
    try {
      const res = await processReportVersion(versionId);
      if (!res.skipped && res.approved) await sendRecompute(res.companyId, `${res.title} approved automatically`);
    } catch (err) {
      await markVersionFailed(versionId, (err as Error).message);
    }
  });
}

const inflight = new Map<string, { again: boolean; trigger?: string; force?: boolean }>();

export async function sendRecompute(companyId: string, trigger?: string, force = false) {
  if (env.hasInngest) {
    await inngest.send({ name: EVENTS.recompute, data: { companyId, trigger, force } });
    return;
  }
  const running = inflight.get(companyId);
  if (running) {
    running.again = true;
    running.trigger = trigger ?? running.trigger;
    running.force ||= force;
    return;
  }
  const state = { again: false, trigger, force };
  inflight.set(companyId, state);
  runLater(async () => {
    try {
      do {
        state.again = false;
        await recomputeCompany(companyId, { trigger: state.trigger, force: state.force });
        state.force = false;
      } while (state.again);
    } finally {
      inflight.delete(companyId);
    }
  });
}
