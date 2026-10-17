/** Number and date formatting shared by server and client. Uses a true minus sign (−) for negatives. */

const MINUS = "−";

export function num(n: number, decimals = 2): string {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (n < 0 && Number(s.replace(/,/g, "")) !== 0 ? MINUS : "") + s;
}

/** "LKR 245.50" — currency code before the price. */
export function money(n: number | null | undefined, currency = "LKR", decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${currency} ${num(n, decimals)}`;
}

/** Fraction → "+18.4%" / "−8.0%". */
export function signedPct(frac: number | null | undefined, decimals = 1): string {
  if (frac === null || frac === undefined || !Number.isFinite(frac)) return "—";
  const v = frac * 100;
  const r = Number(Math.abs(v).toFixed(decimals));
  return (r === 0 ? "" : v >= 0 ? "+" : MINUS) + r.toFixed(decimals) + "%";
}

/** Fraction → "11.0%". */
export function pct(frac: number | null | undefined, decimals = 1): string {
  if (frac === null || frac === undefined || !Number.isFinite(frac)) return "—";
  return num(frac * 100, decimals) + "%";
}

export function multiple(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return num(n, decimals) + "×";
}

export function signedMoney(n: number, currency = "LKR"): string {
  return (n >= 0 ? "+" : MINUS) + `${currency} ${num(Math.abs(n))}`;
}

const asDate = (d: Date | string) => (typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00Z" : d) : d);

/** "16 Oct 2026" */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return asDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "16 Oct 2026, 14:30" in Colombo time. */
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = asDate(d);
  const date = x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" });
  const time = x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Colombo" });
  return `${date}, ${time}`;
}

/** "Oct 2029" */
export function fmtMonthYear(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return asDate(d).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function timeAgo(d: Date | string | null | undefined, now = new Date()): string {
  if (!d) return "—";
  const s = Math.round((now.getTime() - asDate(d).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.floor(s / 86400);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return fmtDate(d);
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function upDown(frac: number): "up" | "down" | "flat" {
  return Math.abs(frac) < 0.0005 ? "flat" : frac > 0 ? "up" : "down";
}
