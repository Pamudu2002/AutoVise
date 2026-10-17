import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import { confidenceLabel } from "@/lib/valuation/confidence";
import { signedPct, upDown } from "@/lib/format";

/** Upside badge: sign, arrow and colour together, so colour is never the only signal. */
export function UpsideBadge({ value, large, label }: { value: number; large?: boolean; label?: string }) {
  const dir = upDown(value);
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : ArrowRight;
  const text = signedPct(value);
  return (
    <span className={`delta ${dir}${large ? " delta-lg" : ""}`} aria-label={`${label ?? "Upside"} ${text}`}>
      <Icon size={large ? 14 : 12} strokeWidth={2.6} aria-hidden />
      {text}
    </span>
  );
}

export function meterClass(v: number) {
  return v >= 70 ? "meter" : v >= 60 ? "meter mid" : "meter low";
}

export function ConfidenceMeter({ value, compact }: { value: number; compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 12 }}>
      {!compact && <span style={{ fontSize: 12, color: "var(--muted)", width: 72 }}>Confidence</span>}
      <div className={meterClass(value)} style={{ flex: 1 }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={`Confidence ${value} of 100`}>
        <span style={{ width: `${value}%` }} />
      </div>
      <span className="num" style={{ fontSize: 13, fontWeight: 600, width: 24, textAlign: "right" }}>
        {value}
      </span>
      {!compact && <span style={{ fontSize: 12, color: "var(--muted)", width: 30 }}>{confidenceLabel(value)}</span>}
    </div>
  );
}

/** Semicircle gauge for the AutoVise Score. */
export function ScoreGauge({ value, size = 112 }: { value: number; size?: number }) {
  const h = Math.round(size * 0.57);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: h }}>
        <svg width={size} height={h} viewBox="0 0 112 64" role="img" aria-label={`AutoVise Score ${value} out of 100`}>
          <path d="M10 58 A46 46 0 0 1 102 58" fill="none" style={{ stroke: "var(--subtle-2)" }} strokeWidth="9" strokeLinecap="round" />
          <path
            d="M10 58 A46 46 0 0 1 102 58"
            fill="none"
            style={{ stroke: "var(--accent)" }}
            strokeWidth="9"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${Math.max(0.5, value)} 100`}
          />
        </svg>
        <span className="num" style={{ position: "absolute", left: 0, right: 0, bottom: 2, textAlign: "center", fontSize: 22, fontWeight: 600 }}>
          {value}
        </span>
      </div>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>AutoVise Score</span>
    </div>
  );
}

export function Disclaimer({ text, icon = true, style }: { text?: string; icon?: boolean; style?: React.CSSProperties }) {
  return (
    <span className="disclaimer" style={style}>
      {icon && <Info size={14} aria-hidden />}
      {text ?? "Predictions are model estimates, not financial advice."}
    </span>
  );
}

const PILL_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  review: "Needs review",
  approved: "Approved",
  failed: "Failed",
  superseded: "Superseded",
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export function StatusPill({ status, label, style }: { status: string; label?: string; style?: React.CSSProperties }) {
  return (
    <span className={`pill pill-${status}`} style={style}>
      {label ?? PILL_LABEL[status] ?? status}
    </span>
  );
}
