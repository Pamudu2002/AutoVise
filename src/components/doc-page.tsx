import Link from "next/link";

/** Long-form reading layout (Methodology.dc.html): document switch and table of contents on the left. */
export function DocPage({ active, toc, children }: { active: "methodology" | "disclaimer"; toc: [string, string][]; children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 80, display: "flex", gap: 56, flexWrap: "wrap", alignItems: "flex-start" }}>
      <aside style={{ flex: "0 1 220px", display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 88 }} aria-label="On this page">
        <div className="seg" role="group" aria-label="Document" style={{ alignSelf: "flex-start" }}>
          <Link href="/methodology" className={`seg-btn${active === "methodology" ? " on" : ""}`} aria-current={active === "methodology" ? "page" : undefined} style={{ padding: "0 12px" }}>
            Methodology
          </Link>
          <Link href="/disclaimer" className={`seg-btn${active === "disclaimer" ? " on" : ""}`} aria-current={active === "disclaimer" ? "page" : undefined} style={{ padding: "0 12px" }}>
            Disclaimer
          </Link>
        </div>
        <span className="eyebrow">On this page</span>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, borderLeft: "1px solid var(--border)" }}>
          {toc.map(([href, text]) => (
            <a key={href} href={href} style={{ padding: "6px 0 6px 14px", marginLeft: -1, borderLeft: "2px solid transparent", color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>
              {text}
            </a>
          ))}
        </nav>
      </aside>
      <article className="prose-doc" style={{ flex: "999 1 560px", minWidth: 0, maxWidth: 700, display: "flex", flexDirection: "column", gap: 40, fontSize: 16.5, lineHeight: 1.75 }}>
        {children}
      </article>
    </div>
  );
}

export function DocHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span className="eyebrow">{eyebrow}</span>
      <h1 style={{ fontSize: 40, lineHeight: 1.12, fontWeight: 600 }}>{title}</h1>
      <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.6 }}>{lead}</p>
    </header>
  );
}
