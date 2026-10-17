import { asc, desc, eq } from "drizzle-orm";
import { EventsAdmin } from "@/components/admin/events-admin";
import { can, requirePageAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { admins, companies, companyEvents } from "@/lib/db/schema";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await requirePageAdmin();
  const [rows, cos] = await Promise.all([
    db
      .select({ e: companyEvents, ticker: companies.ticker, company: companies.name, by: admins.name })
      .from(companyEvents)
      .innerJoin(companies, eq(companies.id, companyEvents.companyId))
      .leftJoin(admins, eq(admins.id, companyEvents.createdBy))
      .orderBy(desc(companyEvents.date))
      .limit(300),
    db.select({ id: companies.id, name: companies.name, ticker: companies.ticker }).from(companies).orderBy(asc(companies.name)),
  ]);
  return (
    <EventsAdmin
      canEdit={can(user.role, "events.write")}
      companies={cos}
      rows={rows.map(({ e, ticker, company, by }) => ({ id: e.id, companyId: e.companyId, ticker, company, date: e.date, title: e.title, body: e.body, sentiment: e.sentiment, sourceUrl: e.sourceUrl, by }))}
    />
  );
}
