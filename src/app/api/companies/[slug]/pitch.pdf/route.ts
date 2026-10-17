import { getCompanyPage } from "@/lib/data/public";
import { buildPitchPdf } from "@/lib/pitch-pdf";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

/** Downloadable one-pager of the published pitch. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const data = await getCompanyPage(slug);
  if (!data || data.company.status !== "published" || !data.prediction) return new Response("Not found", { status: 404 });
  const settings = await getSettings();
  const pdf = await buildPitchPdf(data, settings.disclaimer.long);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.company.ticker}-autovise-pitch.pdf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
