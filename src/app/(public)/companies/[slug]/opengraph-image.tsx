import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "@/lib/blob";
import { getCompanyPage } from "@/lib/data/public";
import { fmtMonthYear, money, signedPct } from "@/lib/format";
import { brandColorOf, initialsOf } from "@/lib/logo-tile";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AutoVise pitch";

async function logoData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const png = await sharp(await readFile(url), { density: 300 }).resize(240, 240, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Social share image per company: logo, name, price, 3-year target and upside. */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCompanyPage(slug);
  const co = data?.company;
  const p = data?.prediction;
  const brand = co ? brandColorOf(co) : "#1F2B7A";
  const logo = co ? await logoData(co.logoUrl) : null;
  const upside = p && co?.price ? p.scenarios.base.y3 / co.price - 1 : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#F6F7F9", padding: 64, fontFamily: "sans-serif", color: "#0D1424" }}>
        <div style={{ display: "flex", height: 8, background: brand, position: "absolute", top: 0, left: 0, right: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 120, height: 120, borderRadius: 24, background: "#FFFFFF", border: "2px solid #E2E6ED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 700, color: brand }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser */}
            {logo ? <img src={logo} width={96} height={96} alt="" /> : co ? initialsOf(co.name) : "AV"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1.5 }}>{co?.name ?? "AutoVise"}</div>
            <div style={{ fontSize: 28, color: "#556073" }}>{co ? `${co.ticker} · ${co.sector}` : "Investment research, pitched like a consultant"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 56, marginTop: 72 }}>
          <Stat label="Current price" value={co ? money(co.price, co.currency) : "—"} />
          {p && co && <Stat label={`3-yr target · ${fmtMonthYear(p.assumptions.horizonDate)}`} value={money(p.scenarios.base.y3, co.currency)} />}
          {upside !== null && <Stat label="Upside" value={signedPct(upside)} color={upside >= 0 ? "#047857" : "#BE123C"} />}
          {!p && <Stat label="Prediction" value="Pending" />}
        </div>
        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#556073" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#1F2B7A", fontWeight: 700, fontSize: 30 }}>AutoVise</div>
          <div style={{ display: "flex" }}>Predictions are model estimates, not financial advice.</div>
        </div>
      </div>
    ),
    size,
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 24, color: "#556073" }}>{label}</div>
      <div style={{ fontSize: 52, fontWeight: 700, color: color ?? "#0D1424" }}>{value}</div>
    </div>
  );
}
