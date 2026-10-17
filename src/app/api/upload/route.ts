import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { ForbiddenError, requireAdmin } from "@/lib/admin";
import { REPORT_MAX_BYTES, REPORT_TYPES } from "@/lib/reports/files";

/**
 * Issues client-upload tokens for Vercel Blob, so large report PDFs go straight from the browser to
 * Blob and skip the function body limit. Only signed-in admins with report permission get a token.
 * Registering the upload (creating the report version) happens in a server action afterwards.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const admin = await requireAdmin("reports.write");
        if (!pathname.startsWith("reports/")) throw new ForbiddenError("Uploads must go under reports/.");
        return {
          allowedContentTypes: [...REPORT_TYPES],
          maximumSizeInBytes: REPORT_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ adminId: admin.id }),
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do: the client calls registerReportUpload once the upload finishes.
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    const status = error instanceof ForbiddenError ? 403 : 400;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
