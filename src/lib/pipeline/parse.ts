import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";
import { isExcel } from "@/lib/reports/files";

export interface ParsedPage {
  page: number;
  text: string;
}

export interface ParsedFile {
  pages: ParsedPage[];
  pageCount: number;
  /** Pages with almost no text layer, usually scanned images. */
  emptyPages: number[];
  kind: "pdf" | "sheet";
}

/** Text per PDF page (unpdf), or one CSV "page" per Excel sheet (SheetJS). */
export async function parseFile(buf: Buffer, mime: string): Promise<ParsedFile> {
  if (isExcel(mime)) {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const pages = wb.SheetNames.map((name, i) => ({
      page: i + 1,
      text: `Sheet: ${name}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false }),
    }));
    return { pages, pageCount: pages.length, emptyPages: [], kind: "sheet" };
  }

  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = text.map((t, i) => ({ page: i + 1, text: normalise(t) }));
  const emptyPages = pages.filter((p) => p.text.replace(/\s+/g, "").length < 40).map((p) => p.page);
  return { pages, pageCount: totalPages, emptyPages, kind: "pdf" };
}

function normalise(t: string): string {
  return t
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "41–44" style ranges for error messages. */
export function pageRanges(pages: number[]): string {
  const out: string[] = [];
  let start = pages[0];
  let prev = pages[0];
  for (const p of [...pages.slice(1), Infinity]) {
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    out.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = p;
    prev = p;
  }
  return out.join(", ");
}
