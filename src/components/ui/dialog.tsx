"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useModal(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  // Keep the latest onClose without re-running the effect (which would steal focus on every render).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab" && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!items.length) return;
        const [a, b] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, ref]);
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  alert?: boolean;
}

/** Modal dialog: focus trap, Escape to close, focus returns to the trigger. */
export function Dialog({ open, onClose, title, subtitle, icon, children, footer, maxWidth = 520, alert }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useModal(open, onClose, ref);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => !alert && e.target === e.currentTarget && onClose()}>
      <section ref={ref} className="dialog" role={alert ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={`${id}-t`} style={{ maxWidth }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 24px 4px" }}>
          {icon}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <h2 id={`${id}-t`} style={{ fontSize: 18, fontWeight: 600 }}>
              {title}
            </h2>
            {subtitle && <span style={{ fontSize: 13, color: "var(--muted)" }}>{subtitle}</span>}
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Close" onClick={onClose} type="button">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div style={{ padding: "16px 24px" }}>{children}</div>
        {footer && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, padding: "16px 24px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            {footer}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560 }: DrawerProps) {
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  useModal(open, onClose, ref);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="overlay" onMouseDown={onClose} />
      <section ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} style={{ width: `min(${width}px, 100%)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <h2 id={`${id}-t`} style={{ fontSize: 18, fontWeight: 600 }}>
              {title}
            </h2>
            {subtitle && <span style={{ fontSize: 13, color: "var(--muted)" }}>{subtitle}</span>}
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Close" onClick={onClose} type="button">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</div>
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 24px", borderTop: "1px solid var(--border)" }}>{footer}</div>}
      </section>
    </>,
    document.body,
  );
}
