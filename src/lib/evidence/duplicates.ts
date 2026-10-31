/**
 * Duplicate candidates (PLAN2 §7.3): pairs in the same study whose texts are near-identical. They
 * are candidates only — an admin marks a duplicate or dismisses the pair.
 */

export interface DuplicateItem {
  id: string;
  recordCode: string;
  text: string;
  embedding: number[] | null;
}

export interface DuplicatePair {
  a: string;
  b: string;
  similarity: number;
  method: "embedding" | "text";
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

/** Word-set Jaccard similarity, the fallback when embeddings are not available. */
export function jaccard(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function duplicateCandidates(items: DuplicateItem[], opts: { threshold?: number; textThreshold?: number; dismissed?: Set<string> } = {}): DuplicatePair[] {
  const threshold = opts.threshold ?? 0.92;
  const textThreshold = opts.textThreshold ?? 0.8;
  const out: DuplicatePair[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const x = items[i];
      const y = items[j];
      if (opts.dismissed?.has(pairKey(x.id, y.id))) continue;
      if (x.embedding && y.embedding) {
        const s = cosine(x.embedding, y.embedding);
        if (s >= threshold) out.push({ a: x.id, b: y.id, similarity: s, method: "embedding" });
      } else {
        const s = jaccard(x.text, y.text);
        if (s >= textThreshold) out.push({ a: x.id, b: y.id, similarity: s, method: "text" });
      }
    }
  }
  return out.sort((p, q) => q.similarity - p.similarity);
}
