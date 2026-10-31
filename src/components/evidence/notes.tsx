import { CircleAlert, Info } from "lucide-react";

/** A list of warnings or limitations, shown as a calm callout. */
export function NoteList({ items, tone = "warn", title }: { items: string[]; tone?: "warn" | "info"; title?: string }) {
  if (!items.length) return null;
  const color = tone === "warn" ? "var(--warn)" : "var(--info)";
  const Icon = tone === "warn" ? CircleAlert : Info;
  return (
    <div className="card" role={tone === "warn" ? "status" : undefined} style={{ padding: 16, display: "flex", gap: 12, background: tone === "warn" ? "var(--warn-soft)" : "var(--info-soft)", borderColor: "transparent" }}>
      <Icon size={18} style={{ color, flexShrink: 0, marginTop: 2 }} aria-hidden />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
        {title && <strong>{title}</strong>}
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SmallSampleNote({ min }: { min: number }) {
  return (
    <p className="hint">
      Counts are shown with their denominator. Percentages appear only where an entity has at least {min} included, coded records. This is an exploratory sample, not a representative survey.
    </p>
  );
}
