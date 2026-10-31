/** The collection window: records must be posted between window_start and the collection date. */

const toDate = (iso: string) => new Date(iso + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** collection_date − months, clamped to the last day of the target month (31 Aug − 6 months = 28/29 Feb). */
export function windowStart(collectionDate: string, months: number): string {
  const d = toDate(collectionDate);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return iso(target);
}

/** Inclusive on both ends. A record without a date cannot be placed in the window. */
export function inWindow(postedAt: string | null | undefined, start: string, end: string): boolean {
  if (!postedAt) return false;
  return postedAt >= start && postedAt <= end;
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, Excel serial numbers and Date objects. */
export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return iso(value);
  if (typeof value === "number" && value > 20000 && value < 80000) {
    // Excel serial date (days since 1899-12-30)
    return iso(new Date(Date.UTC(1899, 11, 30) + value * 86_400_000));
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return valid(+m[3], +m[2], +m[1]);
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return iso(date);
}
