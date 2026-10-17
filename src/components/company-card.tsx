import { AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { Sparkline } from "@/components/sparkline";
import { ConfidenceMeter, UpsideBadge } from "@/components/ui/figures";
import type { CardData } from "@/lib/data/public";
import { fmtDate, fmtMonthYear, money } from "@/lib/format";
import { brandColorOf } from "@/lib/logo-tile";

/** Public company card (Main.dc.html): logo, name, prices, upside, confidence, sparkline and states. */
export function CompanyCard({ c, href, compact }: { c: CardData; href?: string; compact?: boolean }) {
  const hasTarget = c.target !== null && c.upside !== null;
  const Wrapper = href ? Link : "div";
  return (
    <Wrapper
      href={href as string}
      className="card co-card"
      style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 18, padding: compact ? 14 : 20, textDecoration: "none", color: "var(--text)", ["--brand" as string]: brandColorOf(c) }}
    >
      <span aria-hidden="true" className="brand-accent" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <CompanyLogo {...c} size={48} decorative />
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
            <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
              {c.ticker}
            </span>
            <span className="chip">{c.sector}</span>
          </div>
        </div>
        {hasTarget ? (
          <span style={{ alignSelf: "flex-start" }}>
            <UpsideBadge value={c.upside!} />
          </span>
        ) : (
          <span className="pill pill-draft" style={{ alignSelf: "flex-start" }}>
            Pending
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Current price</span>
          <span className="num" style={{ fontSize: compact ? 16 : 18, fontWeight: 600 }}>
            {money(c.price, c.currency)}
          </span>
          {!compact && <span style={{ fontSize: 12, color: "var(--muted)" }}>Updated {fmtDate(c.priceUpdatedAt)}</span>}
        </div>
        {hasTarget ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>3-yr target · base</span>
            <span className="num" style={{ fontSize: compact ? 16 : 18, fontWeight: 600 }}>
              {money(c.target, c.currency)}
            </span>
            {!compact && <span style={{ fontSize: 12, color: "var(--muted)" }}>By {fmtMonthYear(c.horizonDate)}</span>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 10, background: "var(--subtle)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
              <Clock size={14} aria-hidden />
              Prediction pending
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{c.pendingNote}</span>
          </div>
        )}
      </div>

      {c.outdatedLabel && (
        <span className="warn-chip" style={{ alignSelf: "flex-start" }}>
          <AlertTriangle size={13} strokeWidth={2.2} aria-hidden />
          {c.outdatedLabel}
        </span>
      )}

      {hasTarget && c.confidence !== null && <ConfidenceMeter value={c.confidence} compact={compact} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Sparkline
          history={c.spark}
          projection={c.projection}
          height={compact ? 44 : 56}
          label={hasTarget ? `Price history and projection to ${money(c.target, c.currency)}` : "Price history"}
        />
        {!compact && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
            <span>2 yrs history</span>
            <span>{hasTarget ? "3-yr base projection" : "Projection pending"}</span>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
