import { ForbiddenError, requireAdmin } from "@/lib/admin";
import { getRecords, getStudyBundle } from "@/lib/evidence/data";
import { EXCLUSION_LABEL, LANGUAGE_LABEL, PLATFORM_LABEL, PRODUCT_LABEL, type Exclusion } from "@/lib/evidence/types";

export const runtime = "nodejs";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/**
 * Coded records as CSV for analysis outside the app. Leaves out source URLs and contributor refs, so
 * the export carries no personal data or links to individual posts.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ studyId: string }> }) {
  try {
    await requireAdmin("evidence.write");
  } catch (err) {
    return new Response(err instanceof ForbiddenError ? err.message : "Forbidden", { status: 403 });
  }
  const { studyId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(studyId)) return new Response("Not found", { status: 404 });
  const bundle = await getStudyBundle(studyId);
  if (!bundle) return new Response("Not found", { status: 404 });
  const records = await getRecords(studyId);
  const entity = new Map(bundle.entities.map((e) => [e.id, e]));
  const group = new Map(bundle.groups.map((g) => [g.id, g.name]));
  const header = ["Record ID", "Group", "Operator", "Platform", "Service/product", "Review/post date", "Thread ID", "Star rating", "Language", "Relevant text or paraphrase", "English translation", "Theme(s)", "Sentiment", "Switching (Yes/No)", "Switching explanation", "Included (Yes/No)", "Exclusion reason", "Coding status", "In QA sample", "QA result"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of records) {
    const e = entity.get(r.entityId);
    lines.push(
      [
        r.recordCode,
        e ? group.get(e.groupId) : "",
        e?.name ?? "",
        PLATFORM_LABEL[r.platform],
        PRODUCT_LABEL[r.product],
        r.postedAt ?? "",
        r.threadId ?? "",
        r.starRating ?? "",
        LANGUAGE_LABEL[r.language],
        r.text,
        r.translationEn ?? "",
        r.themeKeys.join("; "),
        r.sentiment ?? "",
        r.switching ? "Yes" : "No",
        r.switchingNote ?? "",
        r.included ? "Yes" : "No",
        r.exclusionReason ? EXCLUSION_LABEL[r.exclusionReason as Exclusion] : "",
        r.codingStatus,
        r.inQaSample ? "Yes" : "No",
        r.checkResult ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const name = bundle.study.title.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").slice(0, 60);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name || "evidence"}-records.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
