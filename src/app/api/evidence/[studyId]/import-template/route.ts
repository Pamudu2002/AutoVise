import * as XLSX from "xlsx";
import { ForbiddenError, requireAdmin } from "@/lib/admin";
import { getStudyBundle } from "@/lib/evidence/data";
import { IMPORT_FIELDS } from "@/lib/evidence/import";
import { EXCLUSIONS, LANGUAGES, PLATFORMS, PRODUCTS, SENTIMENTS } from "@/lib/evidence/types";

export const runtime = "nodejs";

/** A blank collection spreadsheet with the import headers and a sheet of allowed values for this study. */
export async function GET(_req: Request, ctx: { params: Promise<{ studyId: string }> }) {
  try {
    await requireAdmin("evidence.write");
  } catch (err) {
    return new Response(err instanceof ForbiddenError ? err.message : "Forbidden", { status: 403 });
  }
  const { studyId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(studyId)) return new Response("Not found", { status: 404 });
  const bundle = await getStudyBundle(studyId);
  if (!bundle) return new Response("Not found", { status: 404 });

  const wb = XLSX.utils.book_new();
  const records = XLSX.utils.aoa_to_sheet([IMPORT_FIELDS.map((f) => f.header)]);
  records["!cols"] = IMPORT_FIELDS.map((f) => ({ wch: Math.max(14, f.header.length + 2) }));
  XLSX.utils.book_append_sheet(wb, records, "Records");

  const lists: [string, readonly string[]][] = [
    ["Operator", bundle.entities.map((e) => e.name)],
    ["Platform", PLATFORMS],
    ["Service/product", PRODUCTS],
    ["Language", LANGUAGES],
    ["Theme(s)", bundle.themes.map((t) => t.key)],
    ["Sentiment", SENTIMENTS],
    ["Exclusion reasons", EXCLUSIONS],
  ];
  const rows = Math.max(...lists.map(([, v]) => v.length));
  const aoa: string[][] = [lists.map(([h]) => h)];
  for (let i = 0; i < rows; i++) aoa.push(lists.map(([, v]) => v[i] ?? ""));
  aoa.push([], ["Notes"], ["Contributor ref is a team code such as T03-C2 — never a username."], ["Dates as YYYY-MM-DD. Separate several themes with semicolons."], ["Air Fibre records need the product evidence column filled."]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Allowed values");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="evidence-import-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
