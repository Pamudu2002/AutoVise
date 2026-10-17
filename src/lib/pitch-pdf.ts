import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import sharp from "sharp";
import { readFile } from "@/lib/blob";
import type { CompanyPageData } from "@/lib/data/public";
import { fmtDate, fmtMonthYear, money, multiple, pct, signedPct } from "@/lib/format";
import { toHundred } from "@/lib/valuation/qualitative";
import { FACTOR_LABELS } from "@/lib/valuation/types";

/** Standard PDF fonts are WinAnsi; replace characters they cannot draw. */
const plain = (s: string) =>
  s
    .replace(/−/g, "-")
    .replace(/×/g, "x")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E -ÿ–—•]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of plain(text).split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

async function logoPng(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    return await sharp(await readFile(url), { density: 300 }).resize(160, 160, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  } catch {
    return null;
  }
}

/** A one-page (or two) printable pitch built from the published prediction. */
export async function buildPitchPdf(data: CompanyPageData, disclaimer: string): Promise<Buffer> {
  const p = data.prediction!;
  const co = data.company;
  const cur = co.currency;
  const doc = await PDFDocument.create();
  doc.setTitle(`${co.name} (${co.ticker}) — AutoVise pitch`);
  doc.setAuthor("AutoVise");
  doc.setSubject("Model estimate, not financial advice");
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const H = 842;
  const M = 48;
  const ink = hex("#0D1424");
  const muted = hex("#556073");
  const navy = hex("#1F2B7A");
  const pos = hex("#047857");
  const neg = hex("#BE123C");
  const line = hex("#E2E6ED");

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const ensure = (h: number) => {
    if (y - h < M + 40) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };
  const text = (t: string, x: number, size: number, f = sans, color = ink) => page.drawText(plain(t), { x, y, size, font: f, color });
  const para = (t: string, size = 10.5, color = ink, indent = 0) => {
    for (const l of wrap(t, sans, size, W - 2 * M - indent)) {
      ensure(size + 4);
      text(l, M + indent, size, sans, color);
      y -= size + 4.5;
    }
  };
  const heading = (t: string) => {
    ensure(40);
    y -= 10;
    text(t.toUpperCase(), M, 8.5, bold, muted);
    y -= 14;
  };

  // Header band
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: co.brandColor ? hex(co.brandColor) : navy });
  const png = await logoPng(co.logoUrl);
  if (png) {
    const img = await doc.embedPng(png);
    page.drawImage(img, { x: M, y: y - 48, width: 48, height: 48 });
  }
  const tx = png ? M + 62 : M;
  y -= 18;
  text(co.name, tx, 20, bold);
  y -= 18;
  text(`${co.ticker} · ${co.sector} · AutoVise pitch, ${fmtDate(p.publishedAt ?? p.createdAt)}`, tx, 10, sans, muted);
  y -= 34;

  // Key figures
  const upside = co.price ? p.scenarios.base.y3 / co.price - 1 : p.upsidePct;
  const figs: [string, string, RGB?][] = [
    ["Current price", money(co.price, cur)],
    [`3-yr target (${fmtMonthYear(p.assumptions.horizonDate)})`, money(p.scenarios.base.y3, cur)],
    ["Upside", signedPct(upside), upside >= 0 ? pos : neg],
    ["Confidence", `${p.confidence}/100`],
    ["AutoVise Score", `${p.autoviseScore}/100`],
  ];
  const colW = (W - 2 * M) / figs.length;
  page.drawRectangle({ x: M, y: y - 44, width: W - 2 * M, height: 54, color: hex("#F0F2F6") });
  figs.forEach(([label, value, color], i) => {
    page.drawText(plain(label), { x: M + 10 + i * colW, y: y - 4, size: 8, font: sans, color: muted });
    page.drawText(plain(value), { x: M + 10 + i * colW, y: y - 26, size: 13, font: bold, color: color ?? ink });
  });
  y -= 70;

  // Scenarios
  heading("Scenarios");
  const rows: [string, string, string, string][] = [
    ["", "Year 1", "Year 2", "Year 3"],
    ["Bear", money(p.scenarios.bear.y1, cur), money(p.scenarios.bear.y2, cur), money(p.scenarios.bear.y3, cur)],
    ["Base", money(p.scenarios.base.y1, cur), money(p.scenarios.base.y2, cur), money(p.scenarios.base.y3, cur)],
    ["Bull", money(p.scenarios.bull.y1, cur), money(p.scenarios.bull.y2, cur), money(p.scenarios.bull.y3, cur)],
  ];
  for (const [i, r] of rows.entries()) {
    ensure(16);
    r.forEach((cell, k) => {
      const f = i === 0 || k === 0 ? bold : sans;
      const x = k === 0 ? M : M + 80 + k * 120 - f.widthOfTextAtSize(plain(cell), 10);
      page.drawText(plain(cell), { x, y, size: 10, font: f, color: i === 0 ? muted : ink });
    });
    y -= 15;
  }

  if (p.pitch) {
    heading("Investment thesis");
    ensure(20);
    for (const l of wrap(p.pitch.thesis.headline, bold, 12.5, W - 2 * M)) {
      ensure(16);
      text(l, M, 12.5, bold);
      y -= 16;
    }
    y -= 2;
    p.pitch.thesis.paragraphs.forEach((x) => para(x.text));
    heading("Key drivers");
    p.pitch.drivers.forEach((d) => para(`• ${d.figure ? d.figure + " — " : ""}${d.title}: ${d.body}`));
    heading("Valuation walkthrough");
    p.pitch.valuation.paragraphs.forEach((x) => para(x.text));
    heading("Risks");
    p.pitch.risks.forEach((r) => para(`• ${r.title ? r.title + ": " : ""}${r.body}`));
    heading("Catalysts");
    p.pitch.catalysts.forEach((r) => para(`• ${r.title ? r.title + ": " : ""}${r.body}`));
    heading("What would change our view");
    para(`Toward the bull case (${money(p.scenarios.bull.y3, cur)}): ${p.pitch.changeView.bull}`);
    para(`Toward the bear case (${money(p.scenarios.bear.y3, cur)}): ${p.pitch.changeView.bear}`);
  }

  heading("Key assumptions");
  const a = p.assumptions;
  para(
    `Base EPS ${money(a.eps0, cur)} (FY${a.epsYear}); EPS growth ${pct(a.growth.blended)} in year 1 easing toward the sector's ${pct(a.growth.sector)}; P/E ${multiple(a.pe0)} today, ${multiple(a.exitPe.final)} at exit (sector ${multiple(a.sector.pe)}); qualitative adjustment ${signedPct(a.qualitative.tiltPct)}.`,
  );
  para(`Factor scores (0-100): ${p.factorScores.map((f) => `${FACTOR_LABELS[f.key]} ${toHundred(f.score)}`).join(", ")}.`, 9.5, muted);
  if (p.citations?.length) {
    heading("Sources");
    p.citations.slice(0, 12).forEach((c) => para(`[${c.id}] ${c.label}`, 8.5, muted));
  }

  // Footer on every page
  for (const pg of doc.getPages()) {
    pg.drawLine({ start: { x: M, y: M + 22 }, end: { x: W - M, y: M + 22 }, thickness: 0.5, color: line });
    const lines = wrap(disclaimer, sans, 7.5, W - 2 * M);
    lines.slice(0, 3).forEach((l, i) => pg.drawText(l, { x: M, y: M + 10 - i * 9, size: 7.5, font: sans, color: muted }));
  }
  return Buffer.from(await doc.save());
}
