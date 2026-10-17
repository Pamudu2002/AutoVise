import { CircleAlert, SearchX } from "lucide-react";
import Link from "next/link";

export function Skeleton({ h = 16, w = "100%", r = 6, style }: { h?: number; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden />;
}

export function CardSkeleton() {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }} aria-hidden>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton h={48} w={48} r={12} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton h={14} w="70%" />
          <Skeleton h={12} w="40%" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Skeleton h={40} />
        <Skeleton h={40} />
      </div>
      <Skeleton h={8} />
      <Skeleton h={56} />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      {icon}
      <h2 style={{ fontSize: 17, fontWeight: 600 }}>{title}</h2>
      <p style={{ color: "var(--muted)", maxWidth: 420 }}>{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card" style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", borderColor: "color-mix(in srgb, var(--neg) 35%, var(--border))" }}>
      <CircleAlert size={28} style={{ color: "var(--neg)" }} aria-hidden />
      <h2 style={{ fontSize: 17, fontWeight: 600 }}>{title}</h2>
      <p style={{ color: "var(--muted)", maxWidth: 420 }}>{body}</p>
      {onRetry && (
        <button className="btn btn-primary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function NotCovered() {
  return (
    <EmptyState
      icon={<SearchX size={28} strokeWidth={1.6} style={{ color: "var(--muted)" }} aria-hidden />}
      title="We don't cover that company"
      body="It may have been delisted or never added. Browse the companies we do cover."
      action={
        <Link className="btn btn-secondary btn-sm" href="/">
          Browse companies
        </Link>
      }
    />
  );
}
