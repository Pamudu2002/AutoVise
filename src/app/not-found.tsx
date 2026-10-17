import Link from "next/link";
import { LogoMark } from "@/components/ui/brand";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", maxWidth: 420 }}>
        <LogoMark size={36} />
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Page not found</h1>
        <p style={{ color: "var(--muted)" }}>The page you were looking for doesn&apos;t exist or has moved.</p>
        <Link className="btn btn-secondary" href="/">
          Browse companies
        </Link>
      </div>
    </main>
  );
}
