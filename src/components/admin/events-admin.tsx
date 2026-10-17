"use client";

import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminMain, PageHeader } from "@/components/admin/page-header";
import { useAction } from "@/components/admin/use-action";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Select } from "@/components/ui/fields";
import { deleteEvent, saveEvent } from "@/lib/actions/events";
import { fmtDate } from "@/lib/format";

interface Row {
  id: string;
  companyId: string;
  ticker: string;
  company: string;
  date: string;
  title: string;
  body: string | null;
  sentiment: number;
  sourceUrl: string | null;
  by: string | null;
}

const sentimentLabel = (s: number) => (s >= 0.6 ? "Very positive" : s > 0.15 ? "Positive" : s <= -0.6 ? "Very negative" : s < -0.15 ? "Negative" : "Neutral");

/** Company news entered by analysts (CEO change, new contract, regulation) — a qualitative input to the factor scores. */
export function EventsAdmin({ rows, companies, canEdit }: { rows: Row[]; companies: { id: string; name: string; ticker: string }[]; canEdit: boolean }) {
  const { exec, pending, error, setError } = useAction();
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<Row | "new" | null>(null);
  const blank = { companyId: companies[0]?.id ?? "", date: new Date().toISOString().slice(0, 10), title: "", body: "", sentiment: "0", sourceUrl: "" };
  const [f, setF] = useState(blank);
  const list = rows.filter((r) => filter === "all" || r.companyId === filter);

  const open = (r: Row | "new") => {
    setError(null);
    setEdit(r);
    setF(r === "new" ? { ...blank, companyId: filter !== "all" ? filter : blank.companyId } : { companyId: r.companyId, date: r.date, title: r.title, body: r.body ?? "", sentiment: String(r.sentiment), sourceUrl: r.sourceUrl ?? "" });
  };
  const save = async () => {
    const res = await exec(() => saveEvent({ ...f, id: edit === "new" ? undefined : edit!.id }));
    if (res.ok) setEdit(null);
  };

  return (
    <AdminMain max={1200}>
      <PageHeader
        title="Events"
        sub="Company news that feeds the sentiment factor. Saving an event recalculates that company's prediction."
        actions={
          canEdit && (
            <button className="btn btn-primary" onClick={() => open("new")} disabled={!companies.length}>
              <Plus size={16} aria-hidden />
              New event
            </button>
          )
        }
      />
      <div className="field" style={{ width: 260 }}>
        <label className="label" htmlFor="ev-co">
          Company
        </label>
        <Select id="ev-co" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {list.length === 0 ? (
        <div className="card" style={{ padding: "40px 24px", textAlign: "center", color: "var(--muted)" }}>
          No events recorded{filter !== "all" ? " for this company" : ""}.
        </div>
      ) : (
        <div className="tbl-box">
          <table className="tbl" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Event</th>
                <th>Sentiment</th>
                <th>Added by</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="tnum" style={{ whiteSpace: "nowrap" }}>
                    {fmtDate(r.date)}
                  </td>
                  <td>
                    <span className="chip num">{r.ticker}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 480 }}>
                      <span style={{ fontWeight: 500 }}>
                        {r.title}
                        {r.sourceUrl && (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Source" style={{ marginLeft: 6 }}>
                            <ExternalLink size={12} aria-hidden />
                          </a>
                        )}
                      </span>
                      {r.body && <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.body}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`delta ${r.sentiment > 0.15 ? "up" : r.sentiment < -0.15 ? "down" : "flat"}`}>
                      {r.sentiment > 0 ? "+" : r.sentiment < 0 ? "−" : ""}
                      {Math.abs(r.sentiment).toFixed(1)} · {sentimentLabel(r.sentiment)}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--muted)" }}>{r.by ?? "—"}</td>
                  <td className="r">
                    {canEdit && (
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => open(r)} aria-label={`Edit ${r.title}`}>
                          <Pencil size={14} aria-hidden />
                          Edit
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--neg)" }} aria-label={`Delete ${r.title}`} disabled={pending} onClick={() => confirm("Delete this event? The company will be recalculated.") && exec(() => deleteEvent(r.id))}>
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
      )}

      <Dialog
        open={edit !== null}
        onClose={() => setEdit(null)}
        maxWidth={560}
        title={edit === "new" ? "New event" : "Edit event"}
        subtitle="Events are a qualitative input: they move the sentiment factor within its cap."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={pending}>
              Save event
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="e-co">
                Company
              </label>
              <Select id="e-co" value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label className="label" htmlFor="e-date">
                Date
              </label>
              <input id="e-date" type="date" className="input num" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="e-title">
              Headline
            </label>
            <input id="e-title" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. New CEO appointed" data-autofocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="e-body">
              Details
            </label>
            <textarea id="e-body" className="textarea" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </div>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <label className="label" htmlFor="e-sent">
                Sentiment for shareholders
              </label>
              <span className="num" style={{ fontWeight: 600 }}>
                {Number(f.sentiment) > 0 ? "+" : Number(f.sentiment) < 0 ? "−" : ""}
                {Math.abs(Number(f.sentiment)).toFixed(1)} · {sentimentLabel(Number(f.sentiment))}
              </span>
            </div>
            <input id="e-sent" type="range" min={-1} max={1} step={0.1} value={f.sentiment} onChange={(e) => setF({ ...f, sentiment: e.target.value })} />
            <div className="hint" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Clearly negative</span>
              <span>Neutral</span>
              <span>Clearly positive</span>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="e-src">
              Source link <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
            </label>
            <input id="e-src" className="input" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://" />
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </Dialog>
    </AdminMain>
  );
}
