"use client";

import { Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AdminMain, Kpi, PageHeader } from "@/components/admin/page-header";
import { useAction } from "@/components/admin/use-action";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/fields";
import { markReviewed } from "@/lib/actions/chat";
import { fmtDateTime } from "@/lib/format";

export interface TopQuestion {
  q: string;
  n: number;
  co: string;
  helpful: number | null;
}
export interface DownVoted {
  id: string;
  sessionId: string;
  co: string;
  q: string;
  a: string;
  reason: string | null;
  note: string | null;
  at: string;
  reviewed: boolean;
}
export interface ConversationMsg {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  feedback: number | null;
}

const RANGE_LABEL = { d1: "Today", d7: "Last 7 days", d30: "Last 30 days" } as const;

/** What visitors ask the consultant, and which answers let them down (ChatInsights.dc.html). */
export function ChatInsights(p: {
  companies: { slug: string; name: string }[];
  co: string;
  range: keyof typeof RANGE_LABEL;
  kpi: { questions: number; helpful: number | null; open: number };
  top: TopQuestion[];
  down: DownVoted[];
  conversations: ConversationMsg[];
}) {
  const router = useRouter();
  const path = usePathname();
  const { exec, pending } = useAction();
  const [convo, setConvo] = useState<string | null>(null);
  const go = (co: string, range: string) => router.replace(`${path}?${new URLSearchParams({ ...(co !== "all" ? { co } : {}), range })}`, { scroll: false });
  const max = Math.max(1, ...p.top.map((t) => t.n));

  return (
    <AdminMain>
      <PageHeader
        title="Chat Insights"
        sub="What visitors ask the consultant, and which answers let them down."
        actions={
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ width: 240 }}>
              <label className="label" htmlFor="ci-co">
                Company
              </label>
              <Select id="ci-co" value={p.co} onChange={(e) => go(e.target.value, p.range)}>
                <option value="all">All companies</option>
                {p.companies.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="seg" role="group" aria-label="Date range">
              {(Object.keys(RANGE_LABEL) as (keyof typeof RANGE_LABEL)[]).map((r) => (
                <button key={r} className={`seg-btn${p.range === r ? " on" : ""}`} aria-pressed={p.range === r} onClick={() => go(p.co, r)} style={{ padding: "0 12px" }}>
                  {r === "d1" ? "Today" : r === "d7" ? "7 days" : "30 days"}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 16 }}>
        <Kpi label="Questions asked" value={p.kpi.questions} note={RANGE_LABEL[p.range]} />
        <Kpi label="Rated helpful" value={p.kpi.helpful === null ? "—" : `${Math.round(p.kpi.helpful * 100)}%`} note="Of answers that were rated" />
        <Kpi label="Down-voted, not reviewed" value={p.kpi.open} note="Listed on the right" danger={p.kpi.open > 0} />
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <section className="card" style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column" }} aria-labelledby="tq-h">
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <h2 id="tq-h" style={{ fontSize: 16, fontWeight: 600 }}>
              Top questions
            </h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Grouped by wording</span>
          </div>
          {p.top.length === 0 ? (
            <p style={{ padding: "32px 20px", color: "var(--muted)", textAlign: "center" }}>No questions in this period.</p>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {p.top.map((t, i) => (
                <li key={t.q} style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) 64px", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                  <span className="num" style={{ color: "var(--muted)", fontSize: 13 }}>
                    {i + 1}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{t.q}</span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="chip num">{t.co}</span>
                      <div className="meter" style={{ flex: 1, maxWidth: 220, minWidth: 80 }}>
                        <span style={{ width: `${(t.n / max) * 100}%` }} />
                      </div>
                      {t.helpful !== null && <span className={`delta ${t.helpful >= 0.7 ? "up" : t.helpful >= 0.5 ? "flat" : "down"}`}>{Math.round(t.helpful * 100)}% helpful</span>}
                    </div>
                  </div>
                  <span className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                    {t.n}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card" style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column" }} aria-labelledby="dv-h">
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <h2 id="dv-h" style={{ fontSize: 16, fontWeight: 600 }}>
              Down-voted answers
            </h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Newest first</span>
          </div>
          {p.down.length === 0 ? (
            <p style={{ padding: "32px 20px", color: "var(--muted)", textAlign: "center" }}>No down-voted answers for this filter.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {p.down.map((d) => (
                <li key={d.id} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8, opacity: d.reviewed ? 0.65 : 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="chip num">{d.co}</span>
                    <span className="pill pill-failed">{d.reason ?? "No reason given"}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>{fmtDateTime(d.at)}</span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>“{d.q}”</span>
                  <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55, paddingLeft: 12, borderLeft: "2px solid var(--border-strong)" }}>{d.a.length > 320 ? d.a.slice(0, 320) + "…" : d.a}</p>
                  {d.note && (
                    <span style={{ fontSize: 13 }}>
                      <strong style={{ fontWeight: 600 }}>Visitor note:</strong> {d.note}
                    </span>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    {d.reviewed ? (
                      <span className="pill pill-approved">Reviewed</span>
                    ) : (
                      <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec(() => markReviewed(d.id), { quiet: true })}>
                        <Check size={14} aria-hidden />
                        Mark reviewed
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => setConvo(d.sessionId)}>
                      Open conversation
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={!!convo} onClose={() => setConvo(null)} maxWidth={640} title="Conversation" subtitle="Anonymous visitor session">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "60vh", overflowY: "auto" }}>
          {p.conversations
            .filter((m) => m.sessionId === convo)
            .map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div className={`bubble ${m.role === "user" ? "user" : "bot"}`}>{m.content}</div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {fmtDateTime(m.at)}
                  {m.feedback === 1 ? " · 👍" : m.feedback === -1 ? " · 👎" : ""}
                </span>
              </div>
            ))}
        </div>
      </Dialog>
    </AdminMain>
  );
}
