/**
 * Writes tests/fixtures/evidence-sample.xlsx: a small synthetic collection spreadsheet for the
 * `telecom-sl-demo` template (fictional operators). Dates are relative to the given collection date.
 *
 *   npx tsx scripts/make-evidence-fixture.ts [YYYY-MM-DD] [out.xlsx]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { sampleRows } from "./evidence-sample";

export function writeEvidenceFixture(file: string, collectionDate: string, uncoded = 3) {
  const rows = sampleRows({ collectionDate, small: true, uncoded });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Records");
  mkdirSync(path.dirname(file), { recursive: true });
  XLSX.writeFile(wb, file);
  return rows.length;
}

if (process.argv[1] && /make-evidence-fixture/.test(process.argv[1])) {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const out = process.argv[3] ?? path.join("tests", "fixtures", "evidence-sample.xlsx");
  const n = writeEvidenceFixture(out, date);
  console.log(`Wrote ${n} rows to ${out} (collection date ${date}).`);
}
