import { NextResponse } from "next/server";
import { ForbiddenError, requireAdmin } from "@/lib/admin";
import { putFile } from "@/lib/blob";
import { env } from "@/lib/env";
import { REPORT_MAX_BYTES, REPORT_TYPES } from "@/lib/reports/files";

/** Local stand-in for Vercel Blob client uploads, used only when BLOB_READ_WRITE_TOKEN is not set. */
export async function POST(request: Request) {
  if (env.hasBlob) return NextResponse.json({ error: "Use /api/upload when Vercel Blob is configured." }, { status: 400 });
  try {
    await requireAdmin("reports.write");
    const form = await request.formData();
    const file = form.get("file");
    const pathname = String(form.get("pathname") ?? "");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
    if (!pathname.startsWith("reports/")) return NextResponse.json({ error: "Uploads must go under reports/." }, { status: 400 });
    if (!(REPORT_TYPES as readonly string[]).includes(file.type)) return NextResponse.json({ error: "Upload a PDF or Excel file." }, { status: 415 });
    if (file.size > REPORT_MAX_BYTES) return NextResponse.json({ error: "Files must be 50 MB or smaller." }, { status: 413 });
    const res = await putFile(pathname, Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json(res);
  } catch (error) {
    const status = error instanceof ForbiddenError ? 403 : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
