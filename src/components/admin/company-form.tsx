"use client";

import { useState } from "react";
import type { AdminCompanyRow } from "@/components/admin/companies-admin";
import { LogoUploader, useLogoPreviewUrl, type LogoState } from "@/components/admin/logo-uploader";
import { useAction } from "@/components/admin/use-action";
import { CompanyCard } from "@/components/company-card";
import { CompanyLogo } from "@/components/company-logo";
import { Drawer } from "@/components/ui/dialog";
import { FieldError, Select, Switch } from "@/components/ui/fields";
import { saveCompany } from "@/lib/actions/companies";
import type { CardData } from "@/lib/data/public";
import { brandColorOf, type LogoBg } from "@/lib/logo-tile";

/** Create / edit drawer (Companies.dc.html): logo uploader, brand colour, details and a live card preview in both themes. */
export function CompanyForm({ company, sectors, onClose }: { company: AdminCompanyRow | null; sectors: { id: string; name: string }[]; onClose: () => void }) {
  const { exec, pending, error } = useAction();
  const [f, setF] = useState({
    name: company?.name ?? "",
    ticker: company?.ticker ?? "",
    sectorId: company?.sectorId ?? sectors[0]?.id ?? "",
    description: company?.description ?? "",
    website: company?.website ?? "",
    currency: company?.currency ?? "LKR",
    shares: company?.sharesOutstanding ? String(company.sharesOutstanding) : "",
    published: company ? company.status === "published" : false,
    brandColor: company?.brandColor ?? brandColorOf({ ticker: company?.ticker ?? "NEW", brandColor: null }),
  });
  const [bg, setBg] = useState<LogoBg>(company?.logoBg ?? "transparent");
  const [logo, setLogo] = useState<LogoState>({ file: null, url: company?.logoUrl ?? null, removed: false });
  const [dark, setDark] = useState<LogoState>({ file: null, url: company?.logoDarkUrl ?? null, removed: false });
  const logoUrl = useLogoPreviewUrl(logo);
  const darkUrl = useLogoPreviewUrl(dark);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    const fd = new FormData();
    if (company) fd.set("id", company.id);
    fd.set("name", f.name);
    fd.set("ticker", f.ticker);
    fd.set("sectorId", f.sectorId);
    fd.set("description", f.description);
    fd.set("website", f.website);
    fd.set("currency", f.currency);
    fd.set("sharesOutstanding", f.shares);
    fd.set("brandColor", f.brandColor);
    fd.set("logoBg", bg);
    fd.set("published", String(f.published));
    if (logo.file) fd.set("logo", logo.file);
    if (logo.removed && !logo.file) fd.set("removeLogo", "true");
    if (dark.file) fd.set("logoDark", dark.file);
    if (dark.removed && !dark.file) fd.set("removeDarkLogo", "true");
    const res = await exec(() => saveCompany(fd));
    if (res.ok) onClose();
  };

  const sectorName = sectors.find((s) => s.id === f.sectorId)?.name ?? "Sector";
  const preview: CardData = {
    id: company?.id ?? "new",
    slug: company?.slug ?? "new",
    name: f.name || "Company name",
    ticker: (f.ticker || "TICKER").toUpperCase(),
    logoUrl,
    logoDarkUrl: darkUrl,
    logoBg: bg,
    logoShape: company?.logoShape ?? "square",
    brandColor: f.brandColor,
    sector: sectorName,
    currency: f.currency,
    price: company?.price ?? 100,
    priceUpdatedAt: company?.priceUpdatedAt ?? null,
    target: company?.target ?? 118,
    upside: company?.target && company.price ? company.target / company.price - 1 : 0.18,
    confidence: company?.confidence ?? 72,
    score: null,
    horizonDate: null,
    spark: company?.spark.length ? company.spark : [80, 84, 82, 88, 86, 91, 95, 93, 98, 100],
    projection: company?.projection.length ? company.projection : [105, 111, 118],
    pendingNote: null,
    outdatedLabel: null,
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={1120}
      title={company ? `Edit ${company.name}` : "New company"}
      subtitle={company ? "Changes show on the public site as soon as you save." : "Add the company, then upload its reports to create the first prediction."}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={pending} type="button">
            {pending ? "Saving…" : company ? "Save changes" : "Create company"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", minHeight: "100%" }}>
        <div style={{ flex: "1 1 480px", minWidth: 0, padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
          <LogoUploader logo={logo} dark={dark} bg={bg} onLogo={setLogo} onDark={setDark} onBg={setBg} />
          <div className="field">
            <label className="label" htmlFor="brand-c">
              Brand colour
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input id="brand-c" type="color" value={f.brandColor} onChange={set("brandColor")} style={{ width: 44, height: 40, padding: 2, border: "1px solid var(--border-strong)", borderRadius: 10, background: "var(--card)", cursor: "pointer" }} />
              <label htmlFor="brand-hex" className="sr-only">
                Brand colour hex value
              </label>
              <input id="brand-hex" className="input num" style={{ width: 120 }} value={f.brandColor} onChange={set("brandColor")} maxLength={7} />
              <span className="hint">Monogram fallback tint and the 2 px card accent.</span>
            </div>
          </div>
          <hr className="divider" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16 }}>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label" htmlFor="f-name">
                Company name
              </label>
              <input id="f-name" className="input" value={f.name} onChange={set("name")} data-autofocus />
            </div>
            <div className="field">
              <label className="label" htmlFor="f-ticker">
                Ticker
              </label>
              <input id="f-ticker" className="input num" value={f.ticker} onChange={(e) => setF({ ...f, ticker: e.target.value.toUpperCase() })} maxLength={12} />
              <span className="hint">As listed on the exchange. Also used in the page address.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="f-sector">
                Sector
              </label>
              <Select id="f-sector" value={f.sectorId} onChange={set("sectorId")}>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-desc">
              Description
            </label>
            <textarea id="f-desc" className="textarea" rows={3} value={f.description} onChange={set("description")} maxLength={400} />
            <span className="hint">Shown under the company name on the public pitch. Keep to two sentences.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-web">
              Website
            </label>
            <input id="f-web" className="input" value={f.website} onChange={set("website")} placeholder="https://" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16 }}>
            <div className="field">
              <label className="label" htmlFor="f-cur">
                Currency
              </label>
              <Select id="f-cur" value={f.currency} onChange={set("currency")}>
                <option>LKR</option>
                <option>USD</option>
              </Select>
            </div>
            <div className="field">
              <label className="label" htmlFor="f-shares">
                Shares outstanding
              </label>
              <input id="f-shares" className="input num" value={f.shares} onChange={set("shares")} inputMode="numeric" />
              <span className="hint">Used to turn net income into EPS when a report omits it.</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "var(--subtle)" }}>
            <Switch on={f.published} onChange={(v) => setF({ ...f, published: v })} labelledBy="pub-l" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span id="pub-l" style={{ fontWeight: 500 }}>
                Visible on the public site
              </span>
              <span className="hint">Drafts are only visible to admins.</span>
            </div>
          </div>
          <FieldError>{error}</FieldError>
        </div>

        <aside style={{ flex: "0 1 400px", minWidth: 300, padding: 24, display: "flex", flexDirection: "column", gap: 14, background: "var(--subtle)", borderLeft: "1px solid var(--border)" }} aria-label="Live preview">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Live preview</h3>
            <span className="hint">The public company card with this logo, in both themes.</span>
          </div>
          {(["Light theme", "Dark theme"] as const).map((label) => (
            <div key={label} className={label === "Dark theme" ? "dark" : "theme-light"} style={{ padding: 12, borderRadius: 14, background: "var(--bg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10, color: "var(--text)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="eyebrow">{label}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <CompanyLogo {...preview} size={32} decorative />
                  <span className="hint num">32 px</span>
                </div>
              </div>
              <CompanyCard c={preview} compact />
            </div>
          ))}
        </aside>
      </div>
    </Drawer>
  );
}
