import { describe, expect, it } from "vitest";
import { chunkPages } from "./chunk";

describe("chunkPages", () => {
  it("keeps chunks within a page and under the size limit", () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} about container throughput and margins.`).join(" ");
    const chunks = chunkPages([{ page: 3, text: long }, { page: 4, text: "short" }, { page: 5, text: "Revenue rose 13% to LKR 30.9 bn in the year under review." }], { maxChars: 500, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.content.length <= 500)).toBe(true);
    expect(chunks.filter((c) => c.page === 4)).toHaveLength(0);
    expect(chunks[chunks.length - 1].page).toBe(5);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });
});
