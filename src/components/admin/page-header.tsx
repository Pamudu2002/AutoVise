export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>{title}</h1>
        {sub && <p style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

export function AdminMain({ children, max = 1400, gap = 20 }: { children: React.ReactNode; max?: number; gap?: number }) {
  return <div style={{ padding: "28px 24px 48px", display: "flex", flexDirection: "column", gap, maxWidth: max, width: "100%" }}>{children}</div>;
}

export function Kpi({ label, value, note, danger, href }: { label: string; value: React.ReactNode; note?: string; danger?: boolean; href?: string }) {
  const style: React.CSSProperties = {
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    textDecoration: "none",
    color: "var(--text)",
    ...(danger ? { borderColor: "var(--neg)", background: "var(--neg-soft)" } : {}),
  };
  const body = (
    <>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
      <span className="num" style={{ fontSize: 28, fontWeight: 600, color: danger ? "var(--neg)" : undefined }}>
        {value}
      </span>
      {note && <span style={{ fontSize: 12, color: "var(--muted)" }}>{note}</span>}
    </>
  );
  return href ? (
    <a href={href} className="card" style={style}>
      {body}
    </a>
  ) : (
    <div className="card" style={style}>
      {body}
    </div>
  );
}
