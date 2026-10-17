"use client";

import { AlertTriangle, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AdminCompanyRow } from "@/components/admin/companies-admin";
import { useAction } from "@/components/admin/use-action";
import { CompanyLogo } from "@/components/company-logo";
import { Sparkline } from "@/components/sparkline";
import { Dialog } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/fields";
import { importPrices, recentPrices, savePrice } from "@/lib/actions/companies";
import type { CsvPreview } from "@/lib/prices";
import { fmtDate, money, num, signedPct } from "@/lib/format";

type Close = { date: string; price: number; source: string };
const TEMPLATE = "data:text/csv;charset=utf-8," + encodeURIComponent("date,close\n2026-10-15,245.50\n2026-10-16,246.10\n");

/** Update-price dialog: enter one close, or import a CSV of closes (with a preview before importing). */
export function PriceDialog({ company, onClose }: { company: AdminCompanyRow; onClose: () => void }) {
  const { exec, pending, error } = useAction();
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [history, setHistory] = useState<Close[] | null>(null);
  const [val, setVal] = useState(company.price ? company.price.toFixed(2) : "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    recentPrices(company.id).then(setHistory).catch(() => setHistory([]));
  }, [company.id]);

  const last = history?.[0];
  const n = Number(val);
  const change = last && n > 0 ? n / last.price - 1 : null;

  const loadCsv = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setCsv({ name: file.name, text });
    const res = await importPrices(company.id, text, false);
    setPreview(res.ok ? res.data! : { read: 0, fresh: [], skipped: 0, errors: [res.error], warnings: [] });
  };

  const save = async () => {
    const res =
      tab === "manual"
        ? await exec(() => savePrice({ companyId: company.id, price: n, date }))
        : csv
          ? await exec(() => importPrices(company.id, csv.text, true))
          : null;
    if (res?.ok) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth={640}
      icon={<CompanyLogo {...company} size={40} decorative />}
      title="Update price"
      subtitle={
        <>
          {company.name} · <span className="num">{company.ticker}</span>
        </>
      }
      footer={
        <>
          <span className="hint" style={{ marginRight: "auto" }}>
            Saving a price updates the upside but not the target.
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={pending || (tab === "manual" ? !(n > 0) : !preview || preview.fresh.length === 0 || preview.errors.length > 0)}>
            {tab === "manual" ? "Save price" : preview ? `Import ${preview.fresh.length} closes` : "Import"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="tabs" role="tablist" aria-label="Price input">
          <button className={`tab${tab === "manual" ? " on" : ""}`} role="tab" aria-selected={tab === "manual"} onClick={() => setTab("manual")}>
            Enter a close
          </button>
          <button className={`tab${tab === "csv" ? " on" : ""}`} role="tab" aria-selected={tab === "csv"} onClick={() => setTab("csv")}>
            Import CSV
          </button>
        </div>

        {tab === "manual" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 16 }}>
              <div className="field">
                <label className="label" htmlFor="p-val">
                  Close price ({company.currency})
                </label>
                <input id="p-val" className="input num" value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" data-autofocus />
                {change !== null && (
                  <span className="hint" style={{ color: Math.abs(change) > 0.1 ? "var(--warn)" : undefined }}>
                    {signedPct(change)} vs last close {last && money(last.price, company.currency)}
                    {Math.abs(change) > 0.1 ? " — check this is right" : ""}
                  </span>
                )}
              </div>
              <div className="field">
                <label className="label" htmlFor="p-date">
                  Trading date
                </label>
                <input id="p-date" className="input num" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="label">Price history</span>
                <span className="hint">Last 6 closes</span>
              </div>
              {history === null ? (
                <div className="sk" style={{ height: 160 }} />
              ) : history.length === 0 ? (
                <p className="hint">No prices stored yet.</p>
              ) : (
                <>
                  <Sparkline history={[...history].reverse().map((h) => h.price)} projection={[]} label="Recent closing prices" />
                  <div className="tbl-box" style={{ borderRadius: 10 }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th className="r">Close</th>
                          <th className="r">Change</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.slice(0, 6).map((h, i) => {
                          const prev = history[i + 1];
                          const ch = prev ? h.price / prev.price - 1 : null;
                          return (
                            <tr key={h.date}>
                              <td className="tnum">{fmtDate(h.date)}</td>
                              <td className="r num">{num(h.price)}</td>
                              <td className="r num" style={{ color: ch === null ? undefined : ch >= 0 ? "var(--pos)" : "var(--neg)" }}>
                                {ch === null ? "—" : signedPct(ch)}
                              </td>
                              <td style={{ fontSize: 13, color: "var(--muted)" }}>{h.source === "csv" ? "CSV import" : h.source === "seed" ? "Sample data" : "Entered"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => loadCsv(e.target.files?.[0])} />
            <div
              className="drop"
              style={{ padding: 28 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void loadCsv(e.dataTransfer.files?.[0]);
              }}
            >
              <Upload size={24} style={{ color: "var(--muted)" }} aria-hidden />
              <span style={{ fontWeight: 500 }}>
                Drop a CSV here, or{" "}
                <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
                  choose a file
                </button>
              </span>
              <span className="hint">
                Columns: date (YYYY-MM-DD), close.{" "}
                <a href={TEMPLATE} download="price-template.csv">
                  Download template
                </a>
              </span>
            </div>
            {csv && preview && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10 }}>
                <span className="num" style={{ width: 36, height: 36, borderRadius: 9, background: "var(--subtle)", color: "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600 }}>
                  CSV
                </span>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <span className="num" style={{ fontSize: 13, fontWeight: 500 }}>
                    {csv.name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {preview.read} rows read · {preview.fresh.length} new · {preview.skipped} skipped (dates already stored)
                  </span>
                </div>
                <span className={`pill ${preview.errors.length ? "pill-failed" : "pill-approved"}`}>{preview.errors.length ? "Errors" : "Ready"}</span>
              </div>
            )}
            {preview?.errors.slice(0, 5).map((e) => (
              <span key={e} className="err">
                {e}
              </span>
            ))}
            {preview?.warnings.slice(0, 5).map((w) => (
              <div key={w} style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: "var(--warn-soft)", fontSize: 13, lineHeight: 1.5 }}>
                <AlertTriangle size={16} style={{ color: "var(--warn)", flex: "none", marginTop: 2 }} aria-hidden />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
        <FieldError>{error}</FieldError>
      </div>
    </Dialog>
  );
}
