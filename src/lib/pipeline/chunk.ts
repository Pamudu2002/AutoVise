import type { ParsedPage } from "./parse";

export interface Chunk {
  page: number;
  index: number;
  content: string;
}

/**
 * Splits page text into overlapping chunks for retrieval. Chunks never cross a page, so every
 * chunk can cite one page. Splits prefer paragraph, then sentence boundaries.
 */
export function chunkPages(pages: ParsedPage[], opts: { maxChars?: number; overlap?: number } = {}): Chunk[] {
  const maxChars = opts.maxChars ?? 1800;
  const overlap = opts.overlap ?? 200;
  const out: Chunk[] = [];
  let index = 0;
  for (const p of pages) {
    const text = p.text.trim();
    if (text.length < 40) continue;
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + maxChars);
      if (end < text.length) {
        const window = text.slice(start, end);
        const para = window.lastIndexOf("\n\n");
        const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf(".\n"));
        const cut = para > maxChars * 0.5 ? para : sentence > maxChars * 0.5 ? sentence + 1 : -1;
        if (cut > 0) end = start + cut;
      }
      const content = text.slice(start, end).trim();
      if (content.length >= 40) out.push({ page: p.page, index: index++, content });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return out;
}
