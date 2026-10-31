import "server-only";
import { after } from "next/server";
import { EVENTS, inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { markVersionFailed, processReportVersion } from "@/lib/pipeline/process";
import { recomputeCompany } from "@/lib/predictions/recompute";
import { codeRecords, embedStudy } from "@/lib/evidence/service";
import { refreshCompanyPitch } from "@/lib/evidence/pitch";

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
        const res = await recomputeCompany(companyId, { trigger: state.trigger, force: state.force });
        if (res.status === "created") await sendPitchRefresh(companyId);
        state.force = false;
      } while (state.again);
    } finally {
      inflight.delete(companyId);
    }
  });
}

/** company/pitch.refresh: re-attach approved customer-evidence findings to the pitch. Never changes numbers. */
export async function sendPitchRefresh(companyId: string) {
  if (env.hasInngest) {
    await inngest.send({ name: EVENTS.pitchRefresh, data: { companyId } });
    return;
  }
  runLater(() => refreshCompanyPitch(companyId));
}

/** evidence/code.requested: AI-assisted coding in batches of 20. Results are suggestions only. */
export async function sendEvidenceCoding(studyId: string, recordIds: string[]) {
  const batches: string[][] = [];
  for (let i = 0; i < recordIds.length; i += 20) batches.push(recordIds.slice(i, i + 20));
  if (env.hasInngest) {
    await inngest.send(batches.map((ids) => ({ name: EVENTS.evidenceCode, data: { studyId, recordIds: ids } })));
    return;
  }
  runLater(async () => {
    for (const ids of batches) await codeRecords(studyId, ids);
  });
}

export async function sendEvidenceEmbed(studyId: string) {
  if (env.hasInngest) {
    await inngest.send({ name: EVENTS.evidenceEmbed, data: { studyId } });
    return;
  }
  runLater(() => embedStudy(studyId));
}
