"use client";

import { ExternalLink, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminMain, PageHeader } from "@/components/admin/page-header";
import { CompanyForm } from "@/components/admin/company-form";
import { PriceDialog } from "@/components/admin/price-dialog";
import { CompanyLogo } from "@/components/company-logo";
import { StatusPill } from "@/components/ui/figures";
import { SearchInput } from "@/components/ui/fields";
import { fmtDate, money } from "@/lib/format";
import type { LogoBg, LogoShape } from "@/lib/logo-tile";

export interface AdminCompanyRow {
  id: string;
  slug: string;
  name: string;
  ticker: string;
  sectorId: string | null;
  sector: string;
  description: string | null;
  website: string | null;
  currency: string;
  sharesOutstanding: number | null;
  brandColor: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  logoBg: LogoBg;
  logoShape: LogoShape;
  status: "draft" | "published";
  price: number | null;
  priceUpdatedAt: string | null;
  stale: boolean;
  reports: number;
  target: number | null;
  confidence: number | null;
  projection: number[];
  spark: number[];
}

type Filter = "all" | "published" | "draft";

export function CompaniesAdmin({ rows, sectors, canWrite, openEdit, openPrice }: { rows: AdminCompanyRow[]; sectors: { id: string; name: string }[]; canWrite: boolean; openEdit: string | null; openPrice: string | null }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [edit, setEdit] = useState<string | null>(openEdit);
  const [price, setPrice] = useState<string | null>(openPrice);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (filter === "all" || r.status === filter) && (!t || r.name.toLowerCase().includes(t) || r.ticker.toLowerCase().includes(t)));
  }, [rows, q, filter]);
  const n = (f: Filter) => (f === "all" ? rows.length : rows.filter((r) => r.status === f).length);
  const close = () => {
    setEdit(null);
    setPrice(null);
    if (openEdit || openPrice) router.replace(path, { scroll: false });
  };
  const editing = edit === "new" ? null : rows.find((r) => r.slug === edit) ?? null;
  const pricing = rows.find((r) => r.slug === price) ?? null;

  return (
    <AdminMain>
      <PageHeader
        title="Companies"
        sub="Listed companies, their prices, and what the public site shows."
        actions={
          canWrite && (
            <button className="btn btn-primary" onClick={() => setEdit("new")}>
              <Plus size={16} aria-hidden />
              New company
            </button>
          )
        }
      />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 280px", maxWidth: 380 }}>
          <label htmlFor="c-q" className="sr-only">
            Search companies
          </label>
          <SearchInput id="c-q" placeholder="Search name or ticker" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg" role="group" aria-label="Status filter">
          {(["all", "published", "draft"] as const).map((f) => (
            <button key={f} className={`seg-btn${filter === f ? " on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)} style={{ padding: "0 12px" }}>
              {f === "all" ? "All" : f === "published" ? "Published" : "Draft"} <span className="num muted">{n(f)}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>No companies yet</h2>
          <p style={{ color: "var(--muted)", maxWidth: 420 }}>Add a company, then upload its latest annual report to generate the first prediction.</p>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setEdit("new")}>
              <Plus size={16} aria-hidden />
              New company
            </button>
          )}
        </div>
      ) : (
        <div className="tbl-box">
          <table className="tbl" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Sector</th>
                <th>Status</th>
                <th className="r">Price</th>
                <th>Last updated</th>
                <th className="r">Reports</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <CompanyLogo {...c} size={36} decorative />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
                          {c.ticker}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{c.sector}</td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                  <td className="r num">{money(c.price, c.currency)}</td>
                  <td>
                    <span className="tnum" style={{ color: c.stale ? "var(--warn)" : undefined }}>
                      {fmtDate(c.priceUpdatedAt)}
                    </span>
                    {c.stale && (
                      <span className="warn-chip" style={{ height: 20, marginLeft: 8, fontSize: 11 }}>
                        Stale
                      </span>
                    )}
                  </td>
                  <td className="r num">{c.reports}</td>
                  <td className="r">
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      {canWrite && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(c.slug)} aria-label={`Edit ${c.name}`}>
                          <Pencil size={14} aria-hidden />
                          Edit
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setPrice(c.slug)}>
                        Update price
                      </button>
                      <Link className="btn btn-ghost btn-sm" href={`/admin/companies/${c.slug}/reports`}>
                        Reports
                      </Link>
                      <Link className="btn btn-ghost btn-icon btn-sm" href={`/companies/${c.slug}`} aria-label={`Open ${c.name} public page`} target="_blank">
                        <ExternalLink size={14} aria-hidden />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                    No companies match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {edit !== null && <CompanyForm key={edit} company={editing} sectors={sectors} onClose={close} />}
      {pricing && <PriceDialog company={pricing} onClose={close} />}
    </AdminMain>
  );
}
