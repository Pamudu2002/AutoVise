"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminMain, PageHeader } from "@/components/admin/page-header";
import { useAction } from "@/components/admin/use-action";
import { Dialog } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/fields";
import { deleteSector, saveSector } from "@/lib/actions/sectors";
import { fmtDate, multiple, pct } from "@/lib/format";

interface Row {
  id: string;
  name: string;
  pe: number;
  growth: number;
  roe: number;
  notes: string | null;
  companies: number;
  updatedAt: string;
}

const empty = { name: "", pe: "10", growth: "6", roe: "12", notes: "" };

/** Sector benchmarks: P/E, long-run growth and ROE that every company's valuation leans toward. */
export function SectorsAdmin({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const { exec, pending, error, setError } = useAction();
  const [edit, setEdit] = useState<Row | "new" | null>(null);
  const [f, setF] = useState(empty);

  const open = (r: Row | "new") => {
    setError(null);
    setEdit(r);
    setF(r === "new" ? empty : { name: r.name, pe: String(r.pe), growth: String(+(r.growth * 100).toFixed(2)), roe: String(+(r.roe * 100).toFixed(2)), notes: r.notes ?? "" });
  };
  const save = async () => {
    const res = await exec(() => saveSector({ id: edit === "new" ? undefined : edit!.id, name: f.name, benchmarkPe: f.pe, benchmarkGrowthPct: f.growth, benchmarkRoePct: f.roe, notes: f.notes }));
    if (res.ok) setEdit(null);
  };

  return (
    <AdminMain max={1100}>
      <PageHeader
        title="Sectors"
        sub="Benchmarks every company's valuation moves toward. Changing them recalculates the sector's companies."
        actions={
          canEdit && (
            <button className="btn btn-primary" onClick={() => open("new")}>
              <Plus size={16} aria-hidden />
              New sector
            </button>
          )
        }
      />
      <div className="tbl-box">
        <table className="tbl" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Sector</th>
              <th className="r">P/E benchmark</th>
              <th className="r">Long-run growth</th>
              <th className="r">ROE benchmark</th>
              <th className="r">Companies</th>
              <th>Updated</th>
              <th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 500 }}>{r.name}</span>
                    {r.notes && <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.notes}</span>}
                  </div>
                </td>
                <td className="r num">{multiple(r.pe)}</td>
                <td className="r num">{pct(r.growth)}</td>
                <td className="r num">{pct(r.roe)}</td>
                <td className="r num">{r.companies}</td>
                <td className="tnum">{fmtDate(r.updatedAt)}</td>
                <td className="r">
                  {canEdit && (
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => open(r)} aria-label={`Edit ${r.name}`}>
                        <Pencil size={14} aria-hidden />
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: "var(--neg)" }}
                        aria-label={`Delete ${r.name}`}
                        disabled={r.companies > 0 || pending}
                        title={r.companies > 0 ? "Move its companies first" : undefined}
                        onClick={() => confirm(`Delete the ${r.name} sector?`) && exec(() => deleteSector(r.id))}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit === "new" ? "New sector" : `Edit ${edit?.name ?? ""}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={pending}>
              Save
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label className="label" htmlFor="s-name">
              Name
            </label>
            <input id="s-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-autofocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {(
              [
                ["pe", "P/E benchmark", "×"],
                ["growth", "Long-run growth", "%"],
                ["roe", "ROE benchmark", "%"],
              ] as const
            ).map(([k, label, unit]) => (
              <div className="field" key={k}>
                <label className="label" htmlFor={`s-${k}`}>
                  {label}
                </label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input id={`s-${k}`} className="input num" style={{ textAlign: "right" }} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode="decimal" />
                  <span className="muted">{unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="field">
            <label className="label" htmlFor="s-notes">
              Notes
            </label>
            <input id="s-notes" className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. Median of 7 listed peers" />
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </Dialog>
    </AdminMain>
  );
}
