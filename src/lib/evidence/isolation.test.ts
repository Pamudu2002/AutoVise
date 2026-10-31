import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PLAN2 rule 1: evidence never changes numbers. The valuation engine and the recompute job — and
 * everything they import — must not touch src/lib/evidence or any evidence_* table.
 */
const SRC = path.resolve(__dirname, "../..");
const SCHEMA = path.join(SRC, "lib/db/schema.ts");
const EVIDENCE_TABLE =
  /\bevidence(Studies|ResearchQuestions|ComparisonGroups|Entities|Themes|PlatformScreenings|Targets|Records|RecordThemes|Findings|DuplicateDismissals)\b|\bevidence_(studies|research_questions|comparison_groups|entities|themes|platform_screenings|targets|records|record_themes|findings|duplicate_dismissals)\b/;

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (existsSync(c) && c.match(/\.tsx?$/)) return c;
  return null;
}

function closure(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const r = resolve(f, m[1] ?? m[2]);
      if (r) stack.push(r);
    }
  }
  return seen;
}

describe("valuation isolation from customer evidence", () => {
  const valuationDir = path.join(SRC, "lib/valuation");
  const entries = [
    ...readdirSync(valuationDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => path.join(valuationDir, f)),
    path.join(SRC, "lib/predictions/recompute.ts"),
    path.join(SRC, "inngest/functions/recompute-company.ts"),
  ];
  const files = closure(entries);

  it("covers the engine and the recompute job", () => {
    expect(files.size).toBeGreaterThan(10);
    expect([...files].some((f) => f.endsWith(path.join("predictions", "inputs.ts")))).toBe(true);
  });

  it("imports nothing from lib/evidence", () => {
    const offenders = [...files].filter((f) => f.includes(`${path.sep}evidence${path.sep}`));
    expect(offenders).toEqual([]);
  });

  it("never references evidence tables", () => {
    const offenders = [...files].filter((f) => f !== SCHEMA && EVIDENCE_TABLE.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
