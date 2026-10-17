"use client";

import { Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Select } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { registerReportUpload } from "@/lib/actions/reports";
import { extLabel, guessFromFileName, mimeOf, REPORT_ACCEPT, REPORT_MAX_BYTES, REPORT_TYPES } from "@/lib/reports/files";
import { uploadReportFile } from "@/lib/reports/upload-client";

type Kind = "annual" | "quarterly" | "interim" | "other";
interface Staged {
  key: string;
  file: File;
  title: string;
  type: Kind;
  fiscalYear: string;
  fiscalPeriod: string;
  periodEnd: string;
  pct: number;
  state: "ready" | "uploading" | "done" | "error";
  error?: string;
}

function periodEndFor(type: Kind, year: number, period: string): string {
  const q = period.match(/Q([1-4])/)?.[1];
  if (q) return `${year}-${["03-31", "06-30", "09-30", "12-31"][Number(q) - 1]}`;
  if (type === "interim") return `${year}-06-30`;
  return `${year}-12-31`;
}

/**
 * Drag-and-drop report upload, several files at once. Files are staged with details guessed from the
 * file name, then uploaded straight to Blob storage and registered as new reports.
 */
export function ReportUploader({ companies, companyId, blobEnabled }: { companies?: { id: string; name: string }[]; companyId?: string; blobEnabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [target, setTarget] = useState(companyId ?? companies?.[0]?.id ?? "");
  const [items, setItems] = useState<Staged[]>([]);
  const busy = items.some((i) => i.state === "uploading");

  const add = (files: FileList | null) => {
    if (!files) return;
    const next: Staged[] = [];
    for (const file of Array.from(files)) {
      const mime = mimeOf(file);
      if (!(REPORT_TYPES as readonly string[]).includes(mime)) {
        toast({ title: "File type not supported", body: `${file.name} is not a PDF or Excel file.`, tone: "error" });
        continue;
      }
      if (file.size > REPORT_MAX_BYTES) {
        toast({ title: "File is too large", body: `${file.name} is over 50 MB.`, tone: "error" });
        continue;
      }
      const g = guessFromFileName(file.name);
      next.push({
        key: `${file.name}-${file.size}-${Math.random()}`,
        file,
        title: g.title,
        type: g.type,
        fiscalYear: String(g.fiscalYear),
        fiscalPeriod: g.fiscalPeriod,
        periodEnd: periodEndFor(g.type, g.fiscalYear, g.fiscalPeriod),
        pct: 0,
        state: "ready",
      });
    }
    setItems((xs) => [...xs, ...next]);
  };
  const patch = (key: string, p: Partial<Staged>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const start = async () => {
    if (!target) return toast({ title: "Choose a company first", tone: "error" });
    let ok = 0;
    for (const it of items.filter((i) => i.state === "ready" || i.state === "error")) {
      patch(it.key, { state: "uploading", pct: 0, error: undefined });
      try {
        const up = await uploadReportFile(it.file, `reports/${target}/${it.file.name}`, blobEnabled, (pct) => patch(it.key, { pct }));
        const res = await registerReportUpload({
          companyId: target,
          url: up.url,
          pathname: up.pathname,
          fileName: it.file.name,
          mime: mimeOf(it.file) as (typeof REPORT_TYPES)[number],
          size: it.file.size,
          title: it.title,
          type: it.type,
          fiscalYear: Number(it.fiscalYear),
          fiscalPeriod: it.fiscalPeriod,
          periodEnd: it.periodEnd || null,
        });
        if (!res.ok) throw new Error(res.error);
        patch(it.key, { state: "done", pct: 100 });
        ok++;
      } catch (err) {
        patch(it.key, { state: "error", error: (err as Error).message });
      }
    }
    if (ok) {
      toast({ title: `${ok} report${ok === 1 ? "" : "s"} uploaded`, body: "Processing has started; extracted data will be ready to review shortly.", tone: "success" });
      router.refresh();
      setTimeout(() => setItems((xs) => xs.filter((x) => x.state !== "done")), 2500);
    }
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-label="Upload reports">
      <input ref={input} type="file" multiple accept={REPORT_ACCEPT} hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      <div
        className={`drop${over ? " over" : ""}`}
        style={{ padding: "32px 24px" }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--primary-text)" }}>
          <Upload size={20} aria-hidden />
        </span>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Drag reports here to upload</span>
        <span className="hint">PDF or Excel · several files at once · up to 50 MB each</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()}>
          Choose files
        </button>
      </div>

      {items.length > 0 && (
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          {companies && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <label className="label" htmlFor="up-co">
                Company
              </label>
              <div style={{ width: 280 }}>
                <Select id="up-co" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          {items.map((u) => (
            <div key={u.key} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <span className="num" style={{ width: 36, height: 36, borderRadius: 9, background: "var(--subtle)", color: "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flex: "none" }}>
                {extLabel(u.file.name)}
              </span>
              <div style={{ flex: "1 1 200px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="num" style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {u.file.name}
                </span>
                <div className="meter" style={{ maxWidth: 320 }} role="progressbar" aria-valuenow={u.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                  <span style={{ width: `${u.pct}%` }} />
                </div>
                {u.error && <span className="err">{u.error}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label className="sr-only" htmlFor={`t-${u.key}`}>
                  Title
                </label>
                <input id={`t-${u.key}`} className="input" style={{ height: 34, fontSize: 13, width: 200 }} value={u.title} onChange={(e) => patch(u.key, { title: e.target.value })} disabled={u.state !== "ready" && u.state !== "error"} />
                <div style={{ width: 130 }}>
                  <label className="sr-only" htmlFor={`ty-${u.key}`}>
                    Report type
                  </label>
                  <Select
                    id={`ty-${u.key}`}
                    style={{ height: 34, fontSize: 13 }}
                    value={u.type}
                    onChange={(e) => {
                      const type = e.target.value as Kind;
                      patch(u.key, { type, periodEnd: periodEndFor(type, Number(u.fiscalYear), u.fiscalPeriod) });
                    }}
                    disabled={u.state !== "ready" && u.state !== "error"}
                  >
                    <option value="annual">Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="interim">Interim</option>
                    <option value="other">Supplementary</option>
                  </Select>
                </div>
                <label className="sr-only" htmlFor={`p-${u.key}`}>
                  Fiscal period
                </label>
                <input id={`p-${u.key}`} className="input" style={{ height: 34, fontSize: 13, width: 120 }} value={u.fiscalPeriod} onChange={(e) => patch(u.key, { fiscalPeriod: e.target.value })} placeholder="FY2026" disabled={u.state !== "ready" && u.state !== "error"} />
                <label className="sr-only" htmlFor={`y-${u.key}`}>
                  Fiscal year
                </label>
                <input id={`y-${u.key}`} className="input num" style={{ height: 34, fontSize: 13, width: 76 }} value={u.fiscalYear} onChange={(e) => patch(u.key, { fiscalYear: e.target.value })} inputMode="numeric" disabled={u.state !== "ready" && u.state !== "error"} />
                <label className="sr-only" htmlFor={`e-${u.key}`}>
                  Period end
                </label>
                <input id={`e-${u.key}`} className="input num" type="date" style={{ height: 34, fontSize: 13, width: 150 }} value={u.periodEnd} onChange={(e) => patch(u.key, { periodEnd: e.target.value })} disabled={u.state !== "ready" && u.state !== "error"} />
              </div>
              <span className="tnum" style={{ width: 84, fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
                {u.state === "ready" ? "Ready" : u.state === "uploading" ? `Uploading ${u.pct}%` : u.state === "done" ? "Uploaded" : "Failed"}
              </span>
              {(u.state === "ready" || u.state === "error") && (
                <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${u.file.name}`} onClick={() => setItems((xs) => xs.filter((x) => x.key !== u.key))}>
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setItems([])} disabled={busy}>
              Clear
            </button>
            <button className="btn btn-primary btn-sm" onClick={start} disabled={busy || !items.some((i) => i.state === "ready" || i.state === "error")}>
              {busy ? "Uploading…" : `Upload ${items.filter((i) => i.state === "ready" || i.state === "error").length} file(s)`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
