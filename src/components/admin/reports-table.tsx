"use client";

import { Info, RotateCcw, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { Dialog } from "@/components/ui/dialog";
import { StatusPill } from "@/components/ui/figures";
import { useToast } from "@/components/ui/toast";
import { deleteReport, registerReportUpload, reprocessVersion } from "@/lib/actions/reports";
import { fmtDate, money } from "@/lib/format";
import { mimeOf, REPORT_ACCEPT, REPORT_TYPE_LABEL, REPORT_TYPES, STATUS_LABEL } from "@/lib/reports/files";
import { uploadReportFile } from "@/lib/reports/upload-client";

export interface VersionRow {
  id: string;
  versionNo: number;
  fileName: string;
  createdAt: string;
  by: string | null;
  pageCount: number | null;
  status: keyof typeof STATUS_LABEL;
  note: string | null;
  error: string | null;
}

export interface ReportRow {
  reportId: string;
  companyId: string;
  companyName?: string;
  title: string;
  type: keyof typeof REPORT_TYPE_LABEL;
  fiscalYear: number;
  fiscalPeriod: string;
  periodEnd: string | null;
  current: VersionRow;
  versions: VersionRow[];
  metricValues: number;
}

export function ReportsTable({ rows, ticker, publishedTarget, currency, blobEnabled, canWrite, showCompany }: { rows: ReportRow[]; ticker?: string; publishedTarget?: number | null; currency?: string; blobEnabled: boolean; canWrite: boolean; showCompany?: boolean }) {
  const { exec, pending } = useAction();
  const toast = useToast();
  const [replace, setReplace] = useState<ReportRow | null>(null);
  const [del, setDel] = useState<ReportRow | null>(null);
  const [ack, setAck] = useState(false);
  const [upPct, setUpPct] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const doReplace = async (f: File | undefined) => {
    if (!f || !replace) return;
    const mime = mimeOf(f);
    if (!(REPORT_TYPES as readonly string[]).includes(mime)) return toast({ title: "File type not supported", body: "Upload a PDF or Excel file.", tone: "error" });
    try {
      setUpPct(0);
      const up = await uploadReportFile(f, `reports/${replace.companyId}/${f.name}`, blobEnabled, setUpPct);
      const res = await exec(
        () =>
          registerReportUpload({
            companyId: replace.companyId,
            reportId: replace.reportId,
            url: up.url,
            pathname: up.pathname,
            fileName: f.name,
            mime: mime as (typeof REPORT_TYPES)[number],
            size: f.size,
            title: replace.title,
            type: replace.type,
            fiscalYear: replace.fiscalYear,
            fiscalPeriod: replace.fiscalPeriod,
            periodEnd: replace.periodEnd,
          }),
        { success: `Uploaded as v${replace.current.versionNo + 1}. The old version is superseded and the prediction will be recalculated.` },
      );
      if (res.ok) setReplace(null);
    } catch (err) {
      toast({ title: "Upload failed", body: (err as Error).message, tone: "error" });
    } finally {
      setUpPct(null);
    }
  };

  if (!rows.length) {
    return (
      <div className="card" style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>No reports uploaded</h2>
        <p style={{ color: "var(--muted)", maxWidth: 380 }}>Upload an annual report to generate this company&apos;s first prediction.</p>
      </div>
    );
  }

  return (
    <>
      <div className="tbl-box">
        <table className="tbl" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th>Report</th>
              {showCompany && <th>Company</th>}
              <th>Type</th>
              <th>Fiscal period</th>
              <th>Version</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = r.current;
              return (
                <tr key={r.reportId}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 500 }}>{r.title}</span>
                      <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
                        {v.fileName}
                      </span>
                      {v.error && <span style={{ fontSize: 12, color: v.status === "failed" ? "var(--neg)" : "var(--warn)", maxWidth: 360 }}>{v.error}</span>}
                    </div>
                  </td>
                  {showCompany && <td>{r.companyName}</td>}
                  <td>{REPORT_TYPE_LABEL[r.type]}</td>
                  <td className="tnum">{r.fiscalPeriod}</td>
                  <td>
                    <span className="chip num">v{v.versionNo}</span>
                  </td>
                  <td>
                    <StatusPill status={v.status} label={STATUS_LABEL[v.status]} />
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span className="tnum" style={{ fontSize: 13 }}>
                        {fmtDate(v.createdAt)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{v.by ?? "—"}</span>
                    </div>
                  </td>
                  <td className="r">
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      {v.status === "review" ? (
                        <Link className="btn btn-primary btn-sm" href={`/admin/reports/${v.id}/review`}>
                          Review
                        </Link>
                      ) : v.status === "failed" ? (
                        canWrite && (
                          <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec(() => reprocessVersion(v.id))}>
                            <RotateCcw size={14} aria-hidden />
                            Retry
                          </button>
                        )
                      ) : (
                        <Link className="btn btn-ghost btn-sm" href={`/admin/reports/${v.id}/review`}>
                          Open
                        </Link>
                      )}
                      {canWrite && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => setReplace(r)}>
                            Replace file
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${r.title}`} style={{ color: "var(--neg)" }} onClick={() => (setAck(false), setDel(r))}>
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!replace}
        onClose={() => upPct === null && setReplace(null)}
        maxWidth={600}
        title="Replace file"
        subtitle={replace?.title}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReplace(null)} disabled={upPct !== null}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => file.current?.click()} disabled={upPct !== null || pending}>
              <Upload size={14} aria-hidden />
              {upPct !== null ? `Uploading ${upPct}%` : `Upload as v${(replace?.current.versionNo ?? 0) + 1}`}
            </button>
          </>
        }
      >
        <input ref={file} type="file" accept={REPORT_ACCEPT} hidden onChange={(e) => doReplace(e.target.files?.[0])} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            className="drop"
            style={{ padding: 20 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void doReplace(e.dataTransfer.files?.[0]);
            }}
          >
            <span style={{ fontWeight: 500 }}>
              Drop the new version here, or{" "}
              <button type="button" className="link-btn" onClick={() => file.current?.click()}>
                choose a file
              </button>
            </span>
            <span className="hint">
              It will become <span className="num">v{(replace?.current.versionNo ?? 0) + 1}</span>. Older versions are kept.
            </span>
            {upPct !== null && (
              <div className="meter" style={{ width: "60%" }} role="progressbar" aria-valuenow={upPct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <span style={{ width: `${upPct}%` }} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="label">Version history</span>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: 12 }}>
              {replace?.versions.map((h) => (
                <li key={h.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <span className="chip num" style={{ color: "var(--text)" }}>
                    v{h.versionNo}
                  </span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {h.fileName}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Uploaded {fmtDate(h.createdAt)}
                      {h.by ? ` by ${h.by}` : ""}
                      {h.pageCount ? ` · ${h.pageCount} pages` : ""}
                    </span>
                    {h.note && <span style={{ fontSize: 13 }}>{h.note}</span>}
                  </div>
                  <StatusPill status={h.id === replace.current.id ? (h.status === "superseded" ? "superseded" : "approved") : h.status} label={h.id === replace.current.id ? "Current" : STATUS_LABEL[h.status]} />
                </li>
              ))}
            </ol>
          </div>
          <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: "var(--info-soft)", fontSize: 13, lineHeight: 1.5 }}>
            <Info size={16} style={{ color: "var(--info)", flex: "none", marginTop: 2 }} aria-hidden />
            <span>
              The current version will be marked Superseded. Its data is re-extracted from the new file, and the {ticker ?? "company's"} prediction is recalculated as a draft for review.
            </span>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!del}
        onClose={() => setDel(null)}
        alert
        maxWidth={480}
        icon={
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--neg-soft)", color: "var(--neg)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Trash2 size={20} aria-hidden />
          </span>
        }
        title={`Delete ${del?.title}?`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDel(null)} data-autofocus>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              disabled={!ack || pending}
              onClick={async () => {
                const res = await exec(() => deleteReport(del!.reportId));
                if (res.ok) setDel(null);
              }}
            >
              Delete report
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>
            <p>
              This removes the file, all {del?.versions.length ?? 1} of its version{del?.versions.length === 1 ? "" : "s"} and the{" "}
              <span className="num" style={{ color: "var(--text)" }}>
                {del?.metricValues ?? 0}
              </span>{" "}
              figures extracted from it.
            </p>
            <p>
              <strong style={{ color: "var(--text)", fontWeight: 600 }}>The {ticker ?? ""} prediction will be recalculated without it</strong> and go back to review.
              {publishedTarget ? (
                <>
                  {" "}
                  The public target stays at{" "}
                  <span className="num" style={{ color: "var(--text)" }}>
                    {money(publishedTarget, currency)}
                  </span>{" "}
                  until a reviewer publishes the new one.
                </>
              ) : null}
            </p>
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, cursor: "pointer", padding: "4px 0" }}>
            <input type="checkbox" className="check" checked={ack} onChange={() => setAck(!ack)} />
            I understand this can&apos;t be undone
          </label>
        </div>
      </Dialog>
    </>
  );
}
