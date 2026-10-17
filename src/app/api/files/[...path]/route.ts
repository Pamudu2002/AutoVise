import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { LOCAL_PREFIX, localPathFor } from "@/lib/blob";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** Serves files stored locally when Vercel Blob is not configured. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const full = localPathFor(LOCAL_PREFIX + parts.map(encodeURIComponent).join("/"));
  if (!full) return new Response("Not found", { status: 404 });
  try {
    await stat(full);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const body = await readFile(full);
  const type = TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  // Uploaded SVGs are sanitised; this also blocks script execution if one is opened directly.
  // (Not applied to PDFs: a sandboxed frame stops the browser's PDF viewer.)
  if (type === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";
  return new Response(new Uint8Array(body), { headers });
}
