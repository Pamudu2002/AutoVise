"use client";

import { ExternalLink } from "lucide-react";
import { useAction } from "@/components/admin/use-action";
import { Switch } from "@/components/ui/fields";
import { setAppendixPublished } from "@/lib/actions/evidence";

export function AppendixPublish({ studyId, published, slug, canApprove, approved }: { studyId: string; published: boolean; slug: string; canApprove: boolean; approved: number }) {
  const { exec, pending } = useAction();
  return (
    <div className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 2 }}>
        <strong id="pub-label">Public methodology appendix</strong>
        <span className="hint" id="pub-hint">
          {published ? "Visible on the company page and linked from the pitch’s customer-evidence notes." : `Not public. ${approved} approved finding${approved === 1 ? "" : "s"} will appear in the pitch either way; the appendix shows how they were reached.`}
        </span>
      </div>
      {published && (
        <a className="btn btn-ghost btn-sm" href={`/companies/${slug}/evidence`} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} aria-hidden />
          View public page
        </a>
      )}
      <Switch on={published} labelledBy="pub-label" describedBy="pub-hint" disabled={!canApprove || pending} onChange={(v) => exec(() => setAppendixPublished(studyId, v))} />
    </div>
  );
}
