import Link from "next/link";
import { getSettings } from "@/lib/settings";

export async function SiteFooter() {
  const settings = await getSettings();
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="wrap" style={{ paddingTop: 40, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
            <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.02em" }}>AutoVise</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Investment research, pitched like a consultant.</span>
          </div>
          <nav aria-label="Footer" style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
            <Link href="/methodology">Methodology</Link>
            <Link href="/disclaimer">Disclaimer</Link>
            <Link href="/track-record">Track record</Link>
            <Link href="/admin/login">Admin sign in</Link>
          </nav>
        </div>
        <hr className="divider" />
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, maxWidth: 900 }}>{settings.disclaimer.long}</p>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>© {new Date().getFullYear()} AutoVise</span>
      </div>
    </footer>
  );
}
