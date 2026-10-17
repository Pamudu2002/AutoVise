import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

export const TAGS = {
  companies: "companies",
  company: (slug: string) => `company:${slug}`,
  trackRecord: "track-record",
};

/** Refreshes cached public pages for a company. Safe to call outside a request (scripts, jobs). */
export function revalidateCompany(slug?: string | null) {
  try {
    revalidateTag(TAGS.companies);
    revalidateTag(TAGS.trackRecord);
    if (slug) {
      revalidateTag(TAGS.company(slug));
      revalidatePath(`/companies/${slug}`);
    }
    revalidatePath("/");
  } catch {
    // Not in a Next.js request context (e.g. the seed script); nothing is cached there.
  }
}
