import { CompanyBrowser } from "@/components/company-browser";
import { getCards } from "@/lib/data/public";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, cards, settings] = await Promise.all([searchParams, getCards(), getSettings()]);
  return <CompanyBrowser cards={cards} disclaimer={settings.disclaimer.short} initialQuery={q ?? ""} />;
}
