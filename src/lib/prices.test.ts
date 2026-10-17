import { describe, expect, it } from "vitest";
import { parsePriceCsv } from "./prices";

describe("parsePriceCsv", () => {
  it("reads rows, skips stored dates and flags big moves", () => {
    const csv = "date,close\n2026-10-01,100\n2026-10-02,101.5\n2026-10-03,115\n2026-10-02,101.5\n";
    const p = parsePriceCsv(csv, [{ date: "2026-10-01", price: 100 }]);
    expect(p.read).toBe(4);
    expect(p.fresh.map((r) => r.date)).toEqual(["2026-10-02", "2026-10-03"]);
    expect(p.skipped).toBe(2);
    expect(p.errors).toEqual([]);
    expect(p.warnings[0]).toContain("Row 4 (2026-10-03) jumps 13.3%");
  });

  it("reports bad dates and prices with row numbers", () => {
    const p = parsePriceCsv("2026/10/01,100\n2026-10-02,abc");
    expect(p.errors).toHaveLength(2);
    expect(p.errors[0]).toContain("Row 1");
    expect(p.errors[1]).toContain("Row 2");
  });
});
