"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useAction } from "@/components/admin/use-action";
import { StatusPill } from "@/components/ui/figures";
import { reprocessVersion } from "@/lib/actions/reports";
import { timeAgo } from "@/lib/format";
import { extLabel, REPORT_TYPE_LABEL, STATUS_LABEL } from "@/lib/reports/files";

export interface QueueRow {
  versionId: string;
  companyName: string;
  ticker: string;
  title: string;
  type: string;
  fiscalPeriod: string;
  fileName: string;
  versionNo: number;
  status: keyof typeof STATUS_LABEL;
  progress: number;
  error: string | null;
  createdAt: string;
}

/** Processing queue rows with status pills, progress, and Review / Retry actions. */
export function QueueList({ items, empty = "No uploads in this period." }: { items: QueueRow[]; empty?: string }) {
  const { exec, pending } = useAction();
  if (!items.length) return <p style={{ padding: "32px 20px", color: "var(--muted)", textAlign: "center" }}>{empty}</p>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {items.map((q) => {
        const proc = q.status === "processing" || q.status === "uploaded";
        return (
          <li key={q.versionId} style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: "var(--subtle)", color: "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", font: "600 10px var(--mono)" }}>
              {extLabel(q.fileName)}
            </span>
            <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="num" style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {q.fileName}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {q.companyName} · {REPORT_TYPE_LABEL[q.type as keyof typeof REPORT_TYPE_LABEL] ?? q.type} · {q.fiscalPeriod}
                {q.versionNo > 1 ? ` · version ${q.versionNo}` : ""}
              </span>
              {q.error && <span style={{ fontSize: 12, color: q.status === "failed" ? "var(--neg)" : "var(--warn)" }}>{q.error}</span>}
            </div>
            <div style={{ width: 160, display: "flex", flexDirection: "column", gap: 6 }}>
              <StatusPill status={q.status} label={STATUS_LABEL[q.status] + (q.status === "processing" ? ` · ${q.progress}%` : "")} style={{ alignSelf: "flex-start" }} />
              {proc && (
                <div className="meter" role="progressbar" aria-valuenow={q.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Processing progress">
                  <span style={{ width: `${Math.max(2, q.progress)}%` }} />
                </div>
              )}
            </div>
            <span style={{ width: 90, fontSize: 12, color: "var(--muted)" }} suppressHydrationWarning>
              {timeAgo(q.createdAt)}
            </span>
            <div style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
              {(q.status === "review" || q.status === "approved") && (
                <Link className="btn btn-secondary btn-sm" href={`/admin/reports/${q.versionId}/review`}>
                  {q.status === "review" ? "Review" : "Open"}
                </Link>
              )}
              {q.status === "failed" && (
                <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec(() => reprocessVersion(q.versionId))}>
                  <RotateCcw size={14} aria-hidden />
                  Retry
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
