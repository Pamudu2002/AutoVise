"use client";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useState } from "react";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
  action?: { label: string; href: string };
}

const Ctx = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});

/** toast({ title, body, tone }) from any client component. */
export const useToast = () => useContext(Ctx);

const ICON = { success: CheckCircle2, error: CircleAlert, info: Info };
const COLOR = { success: "var(--pos)", error: "var(--neg)", info: "var(--info)" };

export function Toaster({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" style={{ position: "fixed", right: 24, bottom: 24, zIndex: 70, display: "flex", flexDirection: "column", gap: 8, maxWidth: "calc(100vw - 32px)" }}>
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} className="toast" role={t.tone === "error" ? "alert" : "status"}>
              <Icon size={18} style={{ color: COLOR[t.tone], flex: "none", marginTop: 1 }} aria-hidden />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</span>
                {t.body && <span style={{ fontSize: 13, color: "var(--muted)" }}>{t.body}</span>}
              </div>
              {t.action && (
                <Link className="btn btn-secondary btn-sm" href={t.action.href} onClick={() => dismiss(t.id)}>
                  {t.action.label}
                </Link>
              )}
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <X size={16} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
