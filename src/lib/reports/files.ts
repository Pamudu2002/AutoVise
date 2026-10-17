/** Report upload rules, shared by the uploader UI, the upload routes and the pipeline. */

export const REPORT_MAX_BYTES = 50 * 1024 * 1024;

export const REPORT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
] as const;

export const REPORT_ACCEPT = ".pdf,.xlsx,.xls,.csv," + REPORT_TYPES.join(",");

export function isExcel(mime: string) {
  return mime.includes("spreadsheet") || mime === "application/vnd.ms-excel" || mime === "text/csv";
}

export function extLabel(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase() ?? "";
  return ext === "XLSX" ? "XLS" : ext.slice(0, 4) || "FILE";
}

/** Guess the MIME type when the browser leaves it empty (common for .xlsx on Windows). */
export function mimeOf(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "csv") return "text/csv";
  return "application/octet-stream";
}

export const REPORT_TYPE_LABEL = { annual: "Annual", quarterly: "Quarterly", interim: "Interim", other: "Supplementary" } as const;

export const STATUS_LABEL = {
  uploaded: "Uploaded",
  processing: "Processing",
  review: "Needs review",
  approved: "Approved",
  failed: "Failed",
  superseded: "Superseded",
} as const;

/** Best-effort report metadata from a file name like "LHL_Q2_2026_Interim.pdf". */
export function guessFromFileName(name: string): { type: "annual" | "quarterly" | "interim" | "other"; fiscalYear: number; fiscalPeriod: string; title: string } {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const year = Number(base.match(/(19|20)\d{2}/)?.[0] ?? new Date().getUTCFullYear());
  const q = base.match(/\bQ([1-4])\b/i)?.[1];
  if (q) return { type: "quarterly", fiscalYear: year, fiscalPeriod: `Q${q} ${year}`, title: `Q${q} ${year} Interim Report` };
  if (/interim|half|H1/i.test(base)) return { type: "interim", fiscalYear: year, fiscalPeriod: `H1 ${year}`, title: `Interim Report ${year}` };
  if (/annual|AR/i.test(base)) return { type: "annual", fiscalYear: year, fiscalPeriod: `FY${year}`, title: `Annual Report ${year}` };
  return { type: "other", fiscalYear: year, fiscalPeriod: `FY${year}`, title: base };
}
