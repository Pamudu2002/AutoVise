export interface CsvRow {
  line: number;
  date: string;
  close: number;
}

export interface CsvPreview {
  read: number;
  fresh: CsvRow[];
  skipped: number;
  errors: string[];
  warnings: string[];
}

const JUMP = 0.1;

/**
 * Parses a "date,close" CSV (header optional, YYYY-MM-DD dates). Rows for dates already stored are
 * skipped; day-to-day moves above 10 % are flagged for checking before import.
 */
export function parsePriceCsv(text: string, existing: { date: string; price: number }[] = []): CsvPreview {
  const stored = new Set(existing.map((e) => e.date));
  const rows: CsvRow[] = [];
  const errors: string[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const [d, c] = line.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, ""));
    if (i === 0 && !/\d/.test(d)) return; // header row
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d + "T00:00:00Z"))) {
      errors.push(`Row ${i + 1}: "${d}" is not a date in YYYY-MM-DD format.`);
      return;
    }
    const close = Number((c ?? "").replace(/,/g, ""));
    if (!Number.isFinite(close) || close <= 0) {
      errors.push(`Row ${i + 1}: "${c ?? ""}" is not a valid closing price.`);
      return;
    }
    rows.push({ line: i + 1, date: d, close });
  });

  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.date) ? false : (seen.add(r.date), true)));
  const fresh = unique.filter((r) => !stored.has(r.date));

  // Check jumps against the full series (stored + new), in date order.
  const series = [...existing.map((e) => ({ date: e.date, close: e.price, line: 0 })), ...fresh].sort((a, b) => a.date.localeCompare(b.date));
  const warnings: string[] = [];
  for (let i = 1; i < series.length; i++) {
    const cur = series[i];
    if (!cur.line) continue;
    const move = cur.close / series[i - 1].close - 1;
    if (Math.abs(move) > JUMP) {
      warnings.push(`Row ${cur.line} (${cur.date}) ${move > 0 ? "jumps" : "drops"} ${(Math.abs(move) * 100).toFixed(1)}% from the previous close. Check it before importing.`);
    }
  }
  return { read: rows.length, fresh, skipped: rows.length - fresh.length, errors, warnings };
}
