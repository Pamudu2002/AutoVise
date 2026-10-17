"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

export interface CiteSource {
  id: string;
  label: string;
  page: number | null;
  quote: string | null;
  section?: string | null;
  url?: string | null;
  version?: string | null;
  doc?: string | null;
}

export function CitationChip({ source, onOpen }: { source: CiteSource; onOpen: (s: CiteSource) => void }) {
  return (
    <button type="button" className="cite" onClick={() => onOpen(source)} aria-label={`Source: ${source.label}`}>
      <FileText size={11} strokeWidth={2.2} aria-hidden />
      {source.label}
    </button>
  );
}

const SECTION: Record<string, string> = {
  management: "Management commentary",
  strategy: "Strategy",
  outlook: "Outlook",
  risk: "Risk management",
  governance: "Governance",
  esg: "Sustainability",
  market: "Market review",
  capital_allocation: "Capital allocation",
  event: "Company news",
};

/** Source preview: the quoted passage highlighted on a page-like card, with a link to the full report. */
export function SourceDialog({ source, onClose }: { source: CiteSource | null; onClose: () => void }) {
  const href = source?.url ? `${source.url}${source.page ? `#page=${source.page}` : ""}` : null;
  return (
    <Dialog
      open={!!source}
      onClose={onClose}
      maxWidth={560}
      icon={
        <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--primary-soft)", color: "var(--primary-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <FileText size={20} strokeWidth={1.8} aria-hidden />
        </span>
      }
      title={source?.doc ?? source?.label.replace(/, p\.\d+$/, "") ?? ""}
      subtitle={[source?.page ? `Page ${source.page}` : null, source?.section ? (SECTION[source.section] ?? source.section) : null].filter(Boolean).join(" · ")}
      footer={
        <>
          <span style={{ fontSize: 12, color: "var(--muted)", marginRight: "auto" }}>{source?.version}</span>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {href && (
            <a className="btn btn-primary" href={href} target="_blank" rel="noopener noreferrer">
              Open full report
              <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </>
      }
    >
      <div style={{ padding: 20, borderRadius: 10, background: "var(--subtle)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10, fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <span style={{ height: 8, width: "70%", borderRadius: 4, background: "var(--subtle-2)" }} />
        <span style={{ height: 8, width: "92%", borderRadius: 4, background: "var(--subtle-2)" }} />
        <p style={{ fontSize: 15, lineHeight: 1.6, padding: "6px 8px", margin: "2px -8px", borderRadius: 6, background: "var(--warn-soft)", color: "var(--text)" }}>
          {source?.quote ? `“${source.quote}”` : "No quotation was stored for this source."}
        </p>
        <span style={{ height: 8, width: "85%", borderRadius: 4, background: "var(--subtle-2)" }} />
        <span style={{ height: 8, width: "60%", borderRadius: 4, background: "var(--subtle-2)" }} />
      </div>
    </Dialog>
  );
}
