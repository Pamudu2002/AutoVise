import { ScreeningTable } from "@/components/evidence/screening-table";
import { adminNames } from "@/lib/evidence/data";
import { loadStudy } from "@/lib/evidence/page";

export const metadata = { title: "Platform screening" };
export const dynamic = "force-dynamic";

export default async function ScreeningPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const { bundle, canWrite } = await loadStudy(studyId);
  const names = await adminNames(bundle.screenings.map((s) => s.screenedBy));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="hint" style={{ fontSize: 14 }}>
        Decide which public platforms are in scope and record why. Collection is manual: AutoVise stores source links as references but never fetches or scrapes them.
      </p>
      <ScreeningTable
        studyId={studyId}
        canWrite={canWrite}
        rows={bundle.screenings.map((s) => ({
          platform: s.platform,
          decision: s.decision,
          reason: s.reason ?? "",
          searchTerms: s.searchTerms.join("\n"),
          sortMethod: s.sortMethod ?? "",
          coverageNote: s.coverageNote ?? "",
          screenedBy: s.screenedBy ? (names[s.screenedBy] ?? null) : null,
          screenedAt: s.screenedAt ? s.screenedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
