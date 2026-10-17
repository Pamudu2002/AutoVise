import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfBlock =
  | { kind: "para"; text: string }
  | { kind: "table"; header: string[]; rows: (string | number | null)[][] };

export interface PdfPageSpec {
  title: string;
  subtitle?: string;
  blocks: PdfBlock[];
}

/** WinAnsi fonts cannot draw a few typographic characters; swap them for plain equivalents. */
const plain = (s: string) => s.replace(/−/g, "-").replace(/×/g, "x").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, "...");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = plain(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const fmt = (v: string | number | null) =>
  v === null ? "-" : typeof v === "number" ? (v < 0 ? `(${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })})` : v.toLocaleString("en-US", { maximumFractionDigits: 2 })) : v;

/** A small, readable sample report: a cover page, narrative pages and statement tables. */
export async function makeReportPdf(input: { company: string; title: string; period: string; pages: PdfPageSpec[] }): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.company} — ${input.title}`);
  doc.setAuthor(input.company);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const W = 595;
  const H = 842;
  const M = 56;
  const ink = rgb(0.07, 0.09, 0.15);
  const grey = rgb(0.42, 0.45, 0.5);

  const header = (page: PDFPage, n: number) => {
    page.drawText(plain(`${input.company.toUpperCase()} PLC`), { x: M, y: H - 36, size: 8, font: sans, color: grey });
    const right = plain(`${input.title} · ${input.period}`);
    page.drawText(right, { x: W - M - sans.widthOfTextAtSize(right, 8), y: H - 36, size: 8, font: sans, color: grey });
    page.drawText(String(n), { x: W / 2 - 3, y: 30, size: 8, font: sans, color: grey });
  };

  // Cover
  const cover = doc.addPage([W, H]);
  cover.drawText(plain(input.company), { x: M, y: H - 260, size: 30, font: bold, color: ink });
  cover.drawText(plain(input.title), { x: M, y: H - 300, size: 20, font, color: ink });
  cover.drawText(plain(input.period), { x: M, y: H - 326, size: 13, font, color: grey });
  cover.drawText("Sample document generated for AutoVise. Fictional company.", { x: M, y: 80, size: 9, font: sans, color: grey });
  header(cover, 1);

  input.pages.forEach((spec, i) => {
    const page = doc.addPage([W, H]);
    header(page, i + 2);
    let y = H - 90;
    page.drawText(plain(spec.title), { x: M, y, size: 18, font: bold, color: ink });
    y -= 20;
    if (spec.subtitle) {
      page.drawText(plain(spec.subtitle), { x: M, y, size: 9, font: sans, color: grey });
      y -= 22;
    } else y -= 8;
    for (const b of spec.blocks) {
      if (b.kind === "para") {
        for (const line of wrap(b.text, font, 11.5, W - 2 * M)) {
          page.drawText(line, { x: M, y, size: 11.5, font, color: ink });
          y -= 17;
        }
        y -= 10;
      } else {
        const cols = b.header.length;
        const first = W - 2 * M - (cols - 1) * 90;
        const xs = [M, ...Array.from({ length: cols - 1 }, (_, k) => M + first + k * 90)];
        b.header.forEach((h, k) => {
          const t = plain(h);
          const x = k === 0 ? xs[0] : xs[k] + 86 - bold.widthOfTextAtSize(t, 9.5);
          page.drawText(t, { x, y, size: 9.5, font: bold, color: ink });
        });
        y -= 6;
        page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: ink });
        y -= 16;
        for (const row of b.rows) {
          row.forEach((cell, k) => {
            const t = plain(String(fmt(cell)));
            const x = k === 0 ? xs[0] : xs[k] + 86 - font.widthOfTextAtSize(t, 10.5);
            page.drawText(t, { x, y, size: 10.5, font, color: k === 2 ? grey : ink });
          });
          y -= 18;
        }
        y -= 12;
      }
    }
  });

  return Buffer.from(await doc.save());
}
