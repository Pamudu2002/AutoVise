"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useAction } from "@/components/admin/use-action";
import { NoteList } from "@/components/evidence/notes";
import { FieldError, Select } from "@/components/ui/fields";
import { commitImport, previewImport } from "@/lib/actions/evidence";
import { autoMap, IMPORT_FIELDS, parseSheet, type ColumnMapping } from "@/lib/evidence/import";

interface Preview {
  valid: number;
  errors: { row: number; recordCode?: string; messages: string[] }[];
  warnings: { row: number; message: string }[];
  autoExcluded: number;
}

/** Upload → map columns → check every row → import all-or-nothing (PLAN2 §7.1). */
export function ImportMapper({ studyId }: { studyId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { exec, pending, error, setError } = useAction();
  const [importing, start] = useTransition();
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<Preview | null>(null);

  const load = async (f: File) => {
    setError(null);
    setPreview(null);
    try {
      const buf = await f.arrayBuffer();
      const sheet = parseSheet(new Uint8Array(buf), f.name);
      if (!sheet.rows.length) throw new Error("The first sheet has no rows.");
      setFile({ name: f.name, headers: sheet.headers, rows: sheet.rows });
      setMapping(autoMap(sheet.headers));
    } catch (err) {
      setFile(null);
      setError((err as Error).message || "Could not read that file.");
    }
  };

  const payload = () => ({ rows: file!.rows, mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => !!v)) as Record<string, string> });
  const missing = IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <FileSpreadsheet size={28} strokeWidth={1.6} style={{ color: "var(--muted)" }} aria-hidden />
        <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 2 }}>
          <strong>{file ? file.name : "Choose the team's collection spreadsheet"}</strong>
          <span className="hint">{file ? `${file.rows.length} rows · ${file.headers.length} columns` : "CSV or Excel (.xlsx). The first sheet is read. Nothing is saved until you import."}</span>
        </div>
        <a className="btn btn-ghost btn-sm" href={`/api/evidence/${studyId}/import-template`}>
          Download blank template
        </a>
        <input
          ref={input}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          aria-label="Spreadsheet file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = "";
          }}
        />
        <button className="btn btn-secondary" onClick={() => input.current?.click()}>
          <Upload size={16} aria-hidden />
          {file ? "Choose another file" : "Choose file"}
        </button>
      </div>
      <FieldError>{error}</FieldError>

      {file && (
        <section className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Map columns</h2>
          <p className="hint">Columns were matched by name. Check them; required fields are marked.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {IMPORT_FIELDS.map((f) => (
              <div key={f.key} className="field">
                <label className="label" htmlFor={`m-${f.key}`}>
                  {f.header}
                  {f.required && <span style={{ color: "var(--neg)" }}> *</span>}
                </label>
                <Select
                  id={`m-${f.key}`}
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => {
                    setPreview(null);
                    setMapping({ ...mapping, [f.key]: e.target.value || undefined });
                  }}
                >
                  <option value="">Not in file</option>
                  {file.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              className="btn btn-primary"
              disabled={pending || missing.length > 0}
              onClick={async () => {
                const res = await exec(() => previewImport(studyId, payload()), { quiet: true });
                if (res.ok && res.data) setPreview(res.data);
              }}
            >
              Check rows
            </button>
            {missing.length > 0 && <span className="hint">Map {missing.map((m) => m.header).join(", ")} first.</span>}
          </div>
        </section>
      )}

      {preview && (
        <section className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }} aria-live="polite">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Check results</h2>
          <p style={{ fontSize: 14 }}>
            <strong className="num">{preview.valid}</strong> rows are valid
            {preview.autoExcluded > 0 && (
              <>
                {" "}
                (<span className="num">{preview.autoExcluded}</span> will be excluded automatically, e.g. outside the window)
              </>
            )}
            . <strong className="num">{preview.errors.length}</strong> rows have errors.
          </p>
          {preview.errors.length > 0 && (
            <div className="tbl-box">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Record</th>
                    <th>Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.slice(0, 100).map((e) => (
                    <tr key={e.row}>
                      <td className="num">{e.row}</td>
                      <td className="num">{e.recordCode ?? "—"}</td>
                      <td style={{ fontSize: 13 }}>{e.messages.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <NoteList items={preview.warnings.slice(0, 30).map((w) => `Row ${w.row}: ${w.message}`)} title="Warnings" />
          <div>
            <button
              className="btn btn-primary"
              disabled={pending || importing || preview.errors.length > 0 || preview.valid === 0}
              onClick={() =>
                // No useAction here: its router.refresh would race this push.
                start(async () => {
                  const res = await commitImport(studyId, payload());
                  if (!res.ok) return setError(res.error);
                  if (res.data) router.push(`/admin/evidence/${studyId}/records?imported=${res.data.inserted + res.data.updated}`);
                })
              }
            >
              Import {preview.valid} records
            </button>
            {preview.errors.length > 0 && <span className="hint" style={{ marginLeft: 12 }}>Fix the errors in the spreadsheet and choose it again. Nothing is imported while any row has errors.</span>}
          </div>
        </section>
      )}
    </div>
  );
}
