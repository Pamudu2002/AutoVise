"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark, Wordmark } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const NAV = [
  { href: "/", label: "Companies", match: (p: string) => p === "/" || p.startsWith("/companies") },
  { href: "/compare", label: "Compare", match: (p: string) => p.startsWith("/compare") },
  { href: "/track-record", label: "Track Record", match: (p: string) => p.startsWith("/track-record") },
  { href: "/methodology", label: "Methodology", match: (p: string) => p.startsWith("/methodology") || p.startsWith("/disclaimer") },
];

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      <div className="wrap" style={{ height: 64, display: "flex", alignItems: "center", gap: 28 }}>
        <Link href="/" aria-label="AutoVise home" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)" }}>
          <LogoMark />
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="hide-sm" style={{ display: "flex", gap: 2 }}>
          {NAV.map((n) => (
            <Link key={n.href} className={`navlink${n.match(path) ? " on" : ""}`} href={n.href} aria-current={n.match(path) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <ThemeToggle />
        <button className="btn btn-ghost btn-icon mobile-only" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="wrap" style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 8, paddingBottom: 12, borderTop: "1px solid var(--border)" }}>
          {NAV.map((n) => (
            <Link key={n.href} className={`navlink${n.match(path) ? " on" : ""}`} href={n.href} style={{ height: 44 }} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
