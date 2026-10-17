import { describe, expect, it } from "vitest";
import { collectNumbers, extractNumbers, numberVariants, ungroundedNumbers } from "./grounding";
import { makePitchSchema, type PitchContent } from "./schemas";

const pitch = (over: Partial<PitchContent> = {}): PitchContent => ({
  thesis: {
    headline: "Earnings growth carries this stock to LKR 318.10.",
    paragraphs: [{ text: "We see LKR 318.10 as fair value, 29.6% above today's LKR 245.50.", cites: ["S1"] }],
  },
  drivers: [
    { figure: "+14%", title: "Container volumes", body: "Throughput rose 14% in 2025.", cites: ["S2"] },
    { figure: "0.42×", title: "Deleveraging", body: "Debt to equity fell to 0.42.", cites: [] },
  ],
  valuation: { paragraphs: [{ text: "EPS of LKR 18.20 grows 11.0% a year; an exit P/E of 12.0× gives the target." }] },
  risks: [{ title: "Customer concentration", body: "Three customers make up 46% of volume.", cites: ["S2"] }],
  catalysts: [{ title: "Q3 2026 results", body: "First full quarter from the new warehouse.", cites: [] }],
  changeView: { bull: "Throughput growth above 18% for two quarters.", bear: "Net margin below 8% for a full year." },
  ...over,
});

const allowed = numberVariants([318.1, 0.296, 245.5, 0.14, 0.42, 18.2, 0.11, 12, 0.46, 0.18, 0.08]);

describe("number grounding", () => {
  it("extracts numbers with their precision and ignores ids, pages and tickers", () => {
    expect(extractNumbers("LKR 1,234.50 and −8.0% at 13.5× (p.34, S3, FY2025, Q2)").map((n) => [n.value, n.decimals])).toEqual([
      [1234.5, 2],
      [-8, 1],
      [13.5, 1],
    ]);
  });

  it("accepts rounded and percent forms of allowed numbers and rejects others", () => {
    expect(ungroundedNumbers("Target LKR 318.10 is 29.6% above LKR 245.50; ROE 18%", allowed)).toEqual([]);
    expect(ungroundedNumbers("Target LKR 350.00 in 2028 for three years", allowed)).toEqual(["350.00"]);
  });

  it("collects numbers from nested values and strings", () => {
    expect(collectNumbers({ a: 1, b: ["x 2.5 y", { c: 3 }] })).toEqual([1, 2.5, 3]);
  });
});

describe("pitch schema", () => {
  const schema = makePitchSchema(allowed, ["S1", "S2"]);

  it("accepts a grounded pitch", () => {
    expect(schema.safeParse(pitch()).success).toBe(true);
  });

  it("rejects an invented number", () => {
    const bad = pitch({ changeView: { bull: "A target of LKR 412.00 is possible.", bear: "Net margin below 8% for a full year." } });
    const res = schema.safeParse(bad);
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain("412.00");
  });

  it("rejects unknown citation ids", () => {
    const bad = pitch({ risks: [{ title: "Currency", body: "Costs are USD-linked.", cites: ["S9"] }] });
    expect(schema.safeParse(bad).success).toBe(false);
  });
});
