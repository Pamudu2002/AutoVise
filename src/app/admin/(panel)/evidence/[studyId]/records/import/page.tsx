import { redirect } from "next/navigation";
import { ImportMapper } from "@/components/evidence/import-mapper";
import { loadStudy } from "@/lib/evidence/page";

export const metadata = { title: "Import evidence records" };
export const dynamic = "force-dynamic";

export default async function ImportPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const { canWrite } = await loadStudy(studyId);
  if (!canWrite) redirect(`/admin/evidence/${studyId}/records`);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="hint" style={{ fontSize: 14 }}>
        Rows with the same Record ID replace the existing record. Usernames, handles, emails and phone numbers are removed from the text on import. Rows coded in the spreadsheet (themes or sentiment) count as human coding.
      </p>
      <ImportMapper studyId={studyId} />
    </div>
  );
}
