import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const session = await auth();
  if (session?.user) redirect("/admin");
  const { callbackUrl } = await searchParams;
  let next = "/admin";
  try {
    if (callbackUrl) next = new URL(callbackUrl, "http://x").pathname;
  } catch {}
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} aria-hidden />
          Back to public site
        </Link>
        <ThemeToggle />
      </div>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px 64px" }}>
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
            <LogoMark size={40} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600 }}>Sign in to AutoVise Admin</h1>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>For analysts and administrators only.</p>
            </div>
          </div>
          <LoginForm next={next} />
          <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>Protected area. Sign-ins and changes are recorded in the audit log.</p>
        </div>
      </main>
    </div>
  );
}
