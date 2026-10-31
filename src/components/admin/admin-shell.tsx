"use client";

import {
  Building2,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileText,
  History,
  LayoutDashboard,
  LineChart,
  Menu,
  MessageSquare,
  MessagesSquare,
  PanelLeft,
  SlidersHorizontal,
  Tag,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { AdminRole } from "@/auth.config";
import { signOutAction } from "@/lib/actions/session";

const NAV = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/admin/companies", label: "Companies", Icon: Building2 },
  { href: "/admin/reports", label: "Reports", Icon: FileText, badge: "reports" as const },
  { href: "/admin/predictions", label: "Predictions", Icon: LineChart, badge: "predictions" as const },
  { href: "/admin/sectors", label: "Sectors", Icon: Tag },
  { href: "/admin/events", label: "Events", Icon: CalendarDays },
  { href: "/admin/evidence", label: "Customer Evidence", Icon: MessagesSquare },
  { href: "/admin/chat-insights", label: "Chat Insights", Icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", Icon: SlidersHorizontal },
  { href: "/admin/users", label: "Users", Icon: Users, roles: ["super_admin"] as AdminRole[] },
  { href: "/admin/audit", label: "Audit Log", Icon: History, roles: ["super_admin", "admin"] as AdminRole[] },
];

const TITLES: [RegExp, string][] = [
  [/^\/admin\/companies\/[^/]+\/reports/, "Reports"],
  [/^\/admin\/reports\/[^/]+\/review/, "Report review"],
  [/^\/admin\/companies\/[^/]+\/evidence/, "Customer Evidence"],
  [/^\/admin\/evidence/, "Customer Evidence"],
  [/^\/admin\/companies/, "Companies"],
  [/^\/admin\/reports/, "Reports"],
  [/^\/admin\/predictions/, "Predictions"],
  [/^\/admin\/sectors/, "Sectors"],
  [/^\/admin\/events/, "Events"],
  [/^\/admin\/chat-insights/, "Chat Insights"],
  [/^\/admin\/settings/, "Settings"],
  [/^\/admin\/users/, "Users"],
  [/^\/admin\/audit/, "Audit Log"],
  [/^\/admin$/, "Dashboard"],
];

interface Props {
  user: { name: string; email: string; role: AdminRole; roleLabel: string };
  badges: { reports: number; predictions: number };
  children: React.ReactNode;
}

export function AdminShell({ user, badges, children }: Props) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("av-admin-collapsed") === "1");
    } catch {}
  }, []);
  useEffect(() => setMobile(false), [path]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const toggle = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem("av-admin-collapsed", collapsed ? "0" : "1");
    } catch {}
  };
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  const isOn = (n: (typeof NAV)[number]) => (n.exact ? path === n.href : path.startsWith(n.href));
  const title = TITLES.find(([re]) => re.test(path))?.[1] ?? "Admin";
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const nav = (compact: boolean) => (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: 12, flex: 1 }} aria-label="Admin">
      {items.map((n) => {
        const on = isOn(n);
        const count = n.badge ? badges[n.badge] : 0;
        return (
          <Link key={n.href} className={`sidelink${on ? " on" : ""}`} href={n.href} aria-current={on ? "page" : undefined} title={compact ? n.label : undefined}>
            <n.Icon size={18} strokeWidth={1.9} aria-hidden />
            <span className="sidelabel" style={{ flex: 1 }}>
              {n.label}
            </span>
            {count > 0 && (
              <span
                className="sidelabel num"
                style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "var(--subtle-2)", color: "var(--text)", fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                aria-label={`${count} need attention`}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <aside
        className={`${collapsed ? "side-collapsed " : ""}hide-sm`}
        style={{ flex: "none", width: collapsed ? 72 : 248, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", transition: "width .2s", position: "sticky", top: 0, height: "100vh" }}
        aria-label="Admin navigation"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 64, padding: "0 16px", borderBottom: "1px solid var(--border)" }}>
          <LogoMark />
          <span className="sidelabel" style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.02em" }}>
            AutoVise
          </span>
          <span className="sidelabel chip" style={{ height: 20, fontSize: 11 }}>
            Admin
          </span>
        </div>
        {nav(collapsed)}
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2 }}>
          <Link className="sidelink" href="/" title="View public site">
            <ExternalLink size={18} strokeWidth={1.9} aria-hidden />
            <span className="sidelabel">View public site</span>
          </Link>
          <button className="sidelink" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
            <PanelLeft size={18} strokeWidth={1.9} aria-hidden />
            <span className="sidelabel">Collapse sidebar</span>
          </button>
        </div>
      </aside>

      {mobile && (
        <>
          <div className="overlay" onMouseDown={() => setMobile(false)} />
          <aside className="drawer" style={{ left: 0, right: "auto", width: 280, borderLeft: 0, borderRight: "1px solid var(--border)" }} aria-label="Admin navigation">
            <div style={{ display: "flex", alignItems: "center", gap: 10, height: 64, padding: "0 16px", borderBottom: "1px solid var(--border)" }}>
              <LogoMark />
              <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>AutoVise</span>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="Close menu" onClick={() => setMobile(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>
            {nav(false)}
          </aside>
        </>
      )}

      <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ height: 64, display: "flex", alignItems: "center", gap: 16, padding: "0 24px", borderBottom: "1px solid var(--border)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 20 }}>
          <button className="btn btn-ghost btn-icon mobile-only" aria-label="Open menu" onClick={() => setMobile(true)}>
            <Menu size={20} aria-hidden />
          </button>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          <div style={{ flex: 1 }} />
          <ThemeToggle />
          <div style={{ position: "relative" }} ref={menuRef}>
            <button className="btn btn-ghost" style={{ padding: "0 8px 0 4px", gap: 10 }} onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
              <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary-soft)", color: "var(--primary-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>
                {initials}
              </span>
              <span className="hide-sm" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{user.roleLabel}</span>
              </span>
              <ChevronDown size={14} style={{ color: "var(--muted)" }} aria-hidden />
            </button>
            {menu && (
              <div className="popover" role="menu" style={{ position: "absolute", right: 0, top: 48, width: 220, padding: 6, display: "flex", flexDirection: "column", zIndex: 40 }}>
                <span style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</span>
                <Link className="sidelink" role="menuitem" href="/admin/users?me=1" style={{ height: 36 }} onClick={() => setMenu(false)}>
                  Change password
                </Link>
                {user.role !== "analyst" && (
                  <Link className="sidelink" role="menuitem" href="/admin/audit" style={{ height: 36 }} onClick={() => setMenu(false)}>
                    Audit log
                  </Link>
                )}
                <form action={signOutAction}>
                  <button className="sidelink" role="menuitem" type="submit" style={{ height: 36, color: "var(--neg)" }}>
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main id="main" style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
