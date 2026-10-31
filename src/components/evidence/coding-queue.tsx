"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { useAction } from "@/components/admin/use-action";
import { requestCoding } from "@/lib/actions/evidence";
import { CodingCard, type CodingRecord } from "./coding-card";

/** The coding queue: AI suggestions waiting for a person first, then uncoded records. */
export function CodingQueue({
  studyId,
  records,
  uncodedIds,
  themes,
  canWrite,
  running,
  aiLabel,
}: {
  studyId: string;
  records: CodingRecord[];
  uncodedIds: string[];
  themes: { key: string; label: string; description: string | null }[];
  canWrite: boolean;
  running: boolean;
  aiLabel: string;
}) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [filter, setFilter] = useState<"all" | "suggested" | "uncoded">("all");
  const list = records.filter((r) => filter === "all" || (filter === "suggested" ? !!r.suggestion : !r.suggestion));
  const suggested = records.filter((r) => r.suggestion).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <AutoRefresh when={running && uncodedIds.length > 0} />
      <div className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Sparkles size={22} style={{ color: "var(--primary)" }} aria-hidden />
        <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 2 }}>
          <strong>AI-assisted coding</strong>
          <span className="hint">
            {aiLabel} drafts themes, sentiment, switching and flags for uncoded records in batches of 20. Suggestions never count until a person accepts them.
          </span>
        </div>
        {canWrite && (
          <button
            className="btn btn-primary"
            disabled={pending || uncodedIds.length === 0 || running}
            onClick={async () => {
              const res = await exec(() => requestCoding(studyId, uncodedIds));
              if (res.ok) router.replace(`/admin/evidence/${studyId}/coding?running=1`);
            }}
          >
            {running && uncodedIds.length > 0 ? "Coding…" : `Suggest coding for ${uncodedIds.length} uncoded`}
          </button>
        )}
      </div>
      <div className="seg" role="tablist" aria-label="Queue filter" style={{ alignSelf: "flex-start" }}>
        {(
          [
            ["all", `All (${records.length})`],
            ["suggested", `AI suggestions (${suggested})`],
            ["uncoded", `Uncoded (${records.length - suggested})`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`seg-btn${filter === k ? " on" : ""}`} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="card" style={{ padding: "40px 24px", textAlign: "center", color: "var(--muted)" }}>
          Nothing to code here. Coded records move on to the QA sample.
        </div>
      ) : (
        list.slice(0, 50).map((r) => <CodingCard key={`${r.id}-${r.suggestion ? "s" : "u"}`} record={r} themes={themes} canWrite={canWrite} />)
      )}
      {list.length > 50 && <p className="hint">Showing the first 50 of {list.length}. Code these to see more.</p>}
    </div>
  );
}
