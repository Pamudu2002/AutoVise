"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CompanyCard } from "@/components/company-card";
import { Disclaimer } from "@/components/ui/figures";
import { SearchInput, Select } from "@/components/ui/fields";
import type { CardData } from "@/lib/data/public";
import { fmtDate } from "@/lib/format";

type Sort = "upside" | "confidence" | "name";
const ALL = "All sectors";

/** Hero search, filter bar and card grid of the home page; both search boxes share one query. */
export function CompanyBrowser({ cards, disclaimer, initialQuery = "" }: { cards: CardData[]; disclaimer: string; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [sector, setSector] = useState(ALL);
  const [sort, setSort] = useState<Sort>("upside");

  const sectors = useMemo(() => [ALL, ...[...new Set(cards.map((c) => c.sector))].sort()], [cards]);
  const latestPrice = useMemo(() => cards.map((c) => c.priceUpdatedAt).filter(Boolean).sort().pop() ?? null, [cards]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = cards.filter(
      (c) => (sector === ALL || c.sector === sector) && (!term || c.name.toLowerCase().includes(term) || c.ticker.toLowerCase().includes(term)),
    );
    if (sort === "upside") out.sort((a, b) => Number(b.upside !== null) - Number(a.upside !== null) || (b.upside ?? 0) - (a.upside ?? 0));
    if (sort === "confidence") out.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [cards, q, sector, sort]);

  return (
    <>
      <section style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="wrap" style={{ paddingTop: 64, paddingBottom: 56, display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start" }}>
          <span className="eyebrow">Equity research desk · {cards[0]?.currency ?? "LKR"} listings</span>
          <h1 className="hero-title" style={{ fontSize: 48, lineHeight: 1.08, fontWeight: 600, maxWidth: 760 }}>
            Investment research, pitched like a consultant.
          </h1>
          <p style={{ fontSize: 17, color: "var(--muted)", maxWidth: 620, lineHeight: 1.6 }}>
            Each listed company gets a three-year price view, a written case for it, and a consultant you can question — built from the company&apos;s own
            financial reports.
          </p>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              document.getElementById("companies")?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{ display: "flex", gap: 8, width: "100%", maxWidth: 620, flexWrap: "wrap" }}
          >
            <label htmlFor="hero-q" className="sr-only">
              Search companies
            </label>
            <div style={{ flex: "1 1 280px" }}>
              <SearchInput id="hero-q" iconSize={18} style={{ height: 48, fontSize: 15 }} placeholder="Search by company name or ticker" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg" type="submit">
              Find research
            </button>
          </form>
          <div className="tnum" style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
            <span>{cards.length} companies covered</span>
            {latestPrice && <span>Prices as of {fmtDate(latestPrice)}</span>}
            <span>3-year horizon, bear / base / bull</span>
          </div>
        </div>
      </section>

      <section id="companies" className="wrap" style={{ paddingTop: 28, paddingBottom: 64, display: "flex", flexDirection: "column", gap: 20, scrollMarginTop: 72 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label className="label" htmlFor="f-q">
              Search
            </label>
            <SearchInput id="f-q" placeholder="Name or ticker" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "0 1 220px" }}>
            <label className="label" htmlFor="f-sector">
              Sector
            </label>
            <Select id="f-sector" value={sector} onChange={(e) => setSector(e.target.value)}>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="field" style={{ flex: "0 1 220px" }}>
            <label className="label" htmlFor="f-sort">
              Sort by
            </label>
            <Select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="upside">Highest upside</option>
              <option value="confidence">Confidence</option>
              <option value="name">Name (A–Z)</option>
            </Select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="tnum" style={{ fontSize: 13, color: "var(--muted)" }} aria-live="polite">
            {list.length} {list.length === 1 ? "company" : "companies"}
            {sector !== ALL ? ` in ${sector}` : ""}
          </span>
          <Disclaimer text={disclaimer} />
        </div>

        {list.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 20 }}>
            {list.map((c) => (
              <CompanyCard key={c.id} c={c} href={`/companies/${c.slug}`} />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="card" style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>No companies yet</h2>
            <p style={{ color: "var(--muted)", maxWidth: 380 }}>Our analysts are preparing the first pitches. Check back soon.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
            <Search size={28} strokeWidth={1.6} style={{ color: "var(--muted)" }} aria-hidden />
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>No companies match these filters</h2>
            <p style={{ color: "var(--muted)", maxWidth: 380 }}>Try a different name or ticker, or show every sector.</p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setQ("");
                setSector(ALL);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </>
  );
}
