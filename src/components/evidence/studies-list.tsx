"use client";

import { MessagesSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Select } from "@/components/ui/fields";
import { EmptyState } from "@/components/ui/states";
import { createEvidenceStudy } from "@/lib/actions/evidence";
import { STATUS_STEPS } from "@/lib/evidence/types";
import { fmtDate } from "@/lib/format";

export interface StudyRow {
  id: string;
  title: string;
  company: string;
  companySlug: string;
  ticker: string;
  status: string;
  collectionDate: string;
  records: number;
  included: number;
  approved: number;
  appendixPublished: boolean;
}

/** Studies table plus the "New study" dialog (template or blank). */
export function StudiesList({
  rows,
  companies,
  templates,
  fixedCompany,
  canWrite,
}: {
  rows: StudyRow[];
  companies: { slug: string; name: string }[];
  templates: { key: string; name: string; description: string }[];
  fixedCompany?: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ companySlug: fixedCompany ?? companies[0]?.slug ?? "", title: "", collectionDate: today, templateKey: templates[0]?.key ?? "" });

  // Navigate straight to the new study (a router.refresh here would race the push).
  const create = () =>
    start(async () => {
      const res = await createEvidenceStudy({ ...f, templateKey: f.templateKey || null });
      if (!res.ok) return setError(res.error);
      if (res.data) router.push(`/admin/evidence/${res.data.id}`);
    });

  const newButton = canWrite && (
    <button
      className="btn btn-primary"
      onClick={() => {
        setError(null);
        setOpen(true);
      }}
      disabled={!companies.length}
    >
      <Plus size={16} aria-hidden />
      New study
    </button>
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>{rows.length > 0 && newButton}</div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare size={28} strokeWidth={1.6} style={{ color: "var(--muted)" }} aria-hidden />}
          title="No customer-evidence studies yet"
          body="A study collects public customer experiences on a few platforms, codes them by theme and turns them into cited, approved findings for the pitch. It never changes the valuation."
          action={newButton || undefined}
        />
      ) : (
        <div className="tbl-box">
          <table className="tbl" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Study</th>
                {!fixedCompany && <th>Company</th>}
                <th>Collected</th>
                <th>Status</th>
                <th className="r">Records</th>
                <th className="r">Approved findings</th>
                <th>Appendix</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/evidence/${r.id}`} style={{ fontWeight: 500 }}>
                      {r.title}
                    </Link>
                  </td>
                  {!fixedCompany && (
                    <td>
                      <span className="chip num">{r.ticker}</span> {r.company}
                    </td>
                  )}
                  <td className="tnum">{fmtDate(r.collectionDate)}</td>
                  <td>{STATUS_STEPS.find((s) => s.key === r.status)?.label ?? r.status}</td>
                  <td className="r num">
                    {r.included} <span style={{ color: "var(--muted)" }}>/ {r.records}</span>
                  </td>
                  <td className="r num">{r.approved}</td>
                  <td>{r.appendixPublished ? <span className="pill pill-published">Published</span> : <span className="pill pill-draft">Not public</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New customer-evidence study"
        subtitle="A template fills in the research questions, comparison groups, themes, targets and platform screening. Everything stays editable."
        maxWidth={560}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={create} disabled={pending}>
              Create study
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!fixedCompany && (
            <div className="field">
              <label className="label" htmlFor="ns-co">
                Company
              </label>
              <Select id="ns-co" value={f.companySlug} onChange={(e) => setF({ ...f, companySlug: e.target.value })}>
                {companies.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="ns-title">
              Title
            </label>
            <input id="ns-title" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Mobile and home-broadband experiences, H2 2026" data-autofocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="ns-date">
              Collection date
            </label>
            <input id="ns-date" type="date" className="input num" value={f.collectionDate} onChange={(e) => setF({ ...f, collectionDate: e.target.value })} />
            <span className="hint">Records must fall in the window that ends on this date (six months by default).</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="ns-tpl">
              Template
            </label>
            <Select id="ns-tpl" value={f.templateKey} onChange={(e) => setF({ ...f, templateKey: e.target.value })}>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
              <option value="">Blank study</option>
            </Select>
            <span className="hint">{templates.find((t) => t.key === f.templateKey)?.description ?? "Start with no questions, groups or themes."}</span>
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </Dialog>
    </>
  );
}
