"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChevronUp, FileText, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SourceDialog, type CiteSource } from "@/components/citation";
import { CompanyLogo } from "@/components/company-logo";
import { FEEDBACK_REASONS, type ChatMeta } from "@/lib/chat";
import type { CompanyBrand } from "@/lib/data/public";

type Msg = UIMessage<ChatMeta>;

interface Props {
  company: CompanyBrand;
  hasPrediction: boolean;
  upside: number | null;
  enabled: boolean;
  knownSources: CiteSource[];
}

const textOf = (m: Msg) =>
  m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
const strip = (t: string) => t.replace(/\s?\[(?:[SR]\d{1,3})(?:,\s*[SR]\d{1,3})*\]/g, "");

function errorText(err: Error | undefined): string | null {
  if (!err) return null;
  try {
    return (JSON.parse(err.message) as { error?: string }).error ?? err.message;
  } catch {
    return err.message || "Something went wrong. Please try again.";
  }
}

/** "Ask the consultant": right-hand panel on desktop, bottom sheet below 1024px. */
export function ChatPanel({ company, hasPrediction, upside, enabled, knownSources }: Props) {
  const { messages, sendMessage, status, error } = useChat<Msg>({
    transport: new DefaultChatTransport({ api: "/api/chat", body: { slug: company.slug } }),
  });
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const [source, setSource] = useState<CiteSource | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  const chips = useMemo(
    () =>
      hasPrediction
        ? [
            `Why is the target ${upside !== null && upside < 0 ? "below" : "above"} today's price?`,
            "What's the biggest risk to this view?",
            "How sensitive is the target to the P/E?",
            "How does it compare with its sector?",
          ]
        : ["When will there be a prediction?", "What do the latest reports say?", "How has revenue changed?", "What are the main risks?"],
    [hasPrediction, upside],
  );
  const remaining = chips.filter((c) => !asked.includes(c));
  const known = useMemo(() => new Map(knownSources.map((s) => [s.id, s])), [knownSources]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy || !enabled) return;
    setOpen(true);
    void sendMessage({ text: t });
    setDraft("");
  };

  const err = errorText(error);
  const last = messages[messages.length - 1];

  return (
    <aside className={`card chat-aside ${open ? "open" : "collapsed"}`} style={{ flex: "1 1 340px", minWidth: 0, overflow: "hidden" }} aria-label="Ask the consultant">
      <button
        className="chat-handle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ width: "100%", alignItems: "center", gap: 12, padding: "12px 16px", border: 0, background: "var(--card)", color: "var(--text)", cursor: "pointer", flexDirection: "column", font: "inherit" }}
      >
        <span style={{ width: 40, height: 4, borderRadius: 999, background: "var(--border-strong)" }} />
        <span style={{ display: "flex", width: "100%", alignItems: "center", gap: 10 }}>
          <CompanyLogo {...company} size={32} decorative />
          <span style={{ fontWeight: 600, fontSize: 15, flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Ask the consultant about {company.ticker}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{open ? "Hide" : `${remaining.length} suggested questions`}</span>
          <ChevronUp size={18} style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : undefined }} aria-hidden />
        </span>
      </button>
      <div className="chat-desk-head" style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderBottom: "1px solid var(--border)" }}>
        <CompanyLogo {...company} size={32} decorative />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>Ask the consultant about {company.name}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Answers draw on {company.ticker}&apos;s reports and this pitch</span>
        </div>
      </div>

      <div className="chat-body" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }} aria-live="polite">
          <div className="bubble bot">
            {hasPrediction
              ? `I've walked you through the ${company.ticker} pitch. Ask me anything about the target, the assumptions or the risks — like the Q&A after a presentation.`
              : `${company.name} doesn't have a published prediction yet, but I can answer from its approved reports and figures.`}
          </div>
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="bubble user">
                {textOf(m)}
              </div>
            ) : (
              <BotMessage key={m.id} m={m} streaming={status === "streaming" && m.id === last?.id} known={known} onCite={setSource} />
            ),
          )}
          {status === "submitted" && (
            <div className="bubble bot" style={{ alignSelf: "flex-start" }}>
              <span className="typing" aria-label="Consultant is typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
          {err && (
            <div role="alert" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--neg-soft)", fontSize: 13, lineHeight: 1.5 }}>
              {err}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
          {!enabled && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--warn-soft)", color: "var(--text)", fontSize: 13 }}>
              The consultant is offline right now. The pitch and figures on this page are still up to date.
            </div>
          )}
          {enabled && remaining.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {remaining.map((q) => (
                <button
                  key={q}
                  className="chip chip-btn"
                  disabled={busy}
                  onClick={() => {
                    setAsked([...asked, q]);
                    ask(q);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <label htmlFor="chat-in" className="sr-only">
              Ask a follow-up question
            </label>
            <input id="chat-in" className="input" placeholder="Ask a follow-up question…" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} disabled={!enabled} />
            <button className="btn btn-primary btn-icon" type="submit" aria-label="Send question" disabled={busy || !draft.trim() || !enabled}>
              <Send size={16} aria-hidden />
            </button>
          </form>
          <span className="disclaimer" style={{ justifyContent: "center", textAlign: "center" }}>
            Not financial advice. Answers can be wrong — check the cited source.
          </span>
        </div>
      </div>
      <SourceDialog source={source} onClose={() => setSource(null)} />
    </aside>
  );
}

function BotMessage({ m, streaming, known, onCite }: { m: Msg; streaming: boolean; known: Map<string, CiteSource>; onCite: (s: CiteSource) => void }) {
  const [vote, setVote] = useState<0 | 1 | -1>(0);
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);
  const [reason, setReason] = useState<string>(FEEDBACK_REASONS[0]);
  const [note, setNote] = useState("");
  const text = textOf(m);
  const dbId = m.metadata?.dbId;
  const fromMeta = m.metadata?.citations ?? [];
  const ids = [...new Set([...text.matchAll(/\[([SR]\d{1,3})\]/g)].map((x) => x[1]))];
  const cites: CiteSource[] = fromMeta.length
    ? fromMeta.map((c) => ({ ...c, url: c.url }))
    : (ids.map((id) => known.get(id)).filter(Boolean) as CiteSource[]);

  // A failed answer leaves an empty message; the error notice below the thread explains it.
  if (!text.trim() && !streaming) return null;

  const send = async (v: 0 | 1 | -1, extra?: { reason: string; note: string }) => {
    if (!dbId) return;
    await fetch("/api/chat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: dbId, vote: v, ...(extra ? { reason: extra.reason, note: extra.note || undefined } : {}) }),
    }).catch(() => {});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="bubble bot">
        <span>{strip(text)}</span>
        {streaming && <span className="caret" aria-hidden="true" />}
      </div>
      {!streaming && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {cites.map((c) => (
            <button key={c.id} className="cite" onClick={() => onCite(c)}>
              <FileText size={11} strokeWidth={2.2} aria-hidden />
              {c.label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          {dbId && (
            <>
              <button
                className={`btn btn-ghost btn-icon btn-sm${vote === 1 ? " on-up" : ""}`}
                aria-label="Helpful answer"
                aria-pressed={vote === 1}
                onClick={() => {
                  const v = vote === 1 ? 0 : 1;
                  setVote(v);
                  setAsking(false);
                  void send(v);
                }}
              >
                <ThumbsUp size={14} aria-hidden />
              </button>
              <button
                className={`btn btn-ghost btn-icon btn-sm${vote === -1 ? " on-down" : ""}`}
                aria-label="Unhelpful answer"
                aria-pressed={vote === -1}
                onClick={() => {
                  const v = vote === -1 ? 0 : -1;
                  setVote(v);
                  setAsking(v === -1);
                  setSent(false);
                  void send(v);
                }}
              >
                <ThumbsDown size={14} aria-hidden />
              </button>
            </>
          )}
        </div>
      )}
      {asking && !sent && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(-1, { reason, note });
            setSent(true);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
        >
          <span style={{ fontSize: 12, color: "var(--muted)" }}>What was wrong? (optional)</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FEEDBACK_REASONS.map((r) => (
              <button key={r} type="button" className={`seg-btn${reason === r ? " on" : ""}`} style={{ border: "1px solid var(--border)" }} aria-pressed={reason === r} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <label htmlFor={`note-${m.id}`} className="sr-only">
            Note
          </label>
          <input id={`note-${m.id}`} className="input" style={{ height: 34, fontSize: 13 }} placeholder="Add a note for our analysts" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <button className="btn btn-secondary btn-sm" type="submit" style={{ alignSelf: "flex-end" }}>
            Send feedback
          </button>
        </form>
      )}
      {sent && <span style={{ fontSize: 12, color: "var(--muted)" }}>Thanks — our analysts review these.</span>}
    </div>
  );
}
