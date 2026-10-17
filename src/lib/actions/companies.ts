"use server";

import { and, desc, eq, gte, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteFile, putFile } from "@/lib/blob";
import { revalidateCompany } from "@/lib/cache";
import { db } from "@/lib/db";
import { companies, priceHistory } from "@/lib/db/schema";
import { LogoError, processLogo } from "@/lib/logo";
import { parsePriceCsv, type CsvPreview } from "@/lib/prices";
import { run, UserError, type ActionResult } from "./result";

const companySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter the company name.").max(120),
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9.]{1,12}$/, "Tickers use letters, digits and dots (up to 12)."),
  sectorId: z.string().uuid("Choose a sector."),
  description: z.string().trim().max(400).optional().default(""),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => !v || /^https?:\/\//.test(v), "Website must start with http:// or https://")
    .optional()
    .default(""),
  currency: z.string().trim().toUpperCase().length(3),
  sharesOutstanding: z.preprocess((v) => (v === "" || v === null ? null : Number(String(v).replace(/,/g, ""))), z.number().positive("Shares outstanding must be positive.").nullable()),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Brand colour must be a hex value like #1F4E8C.")
    .or(z.literal(""))
    .optional(),
  logoBg: z.enum(["light", "dark", "transparent"]),
  published: z.boolean(),
});

async function storeLogo(companyId: string, file: File, suffix: string) {
  const processed = await processLogo(Buffer.from(await file.arrayBuffer()), file.type);
  const stored = await putFile(`logos/${companyId}/${suffix}.${processed.ext}`, processed.body, processed.contentType);
  return { url: stored.url, shape: processed.shape };
}

/** Create or edit a company, including logo upload/replace/remove. */
export async function saveCompany(form: FormData): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    return await run(async () => {
      const admin = await requireAdmin("companies.write");
      const d = companySchema.parse({
        id: form.get("id") || undefined,
        name: form.get("name"),
        ticker: form.get("ticker"),
        sectorId: form.get("sectorId"),
        description: form.get("description") ?? "",
        website: form.get("website") ?? "",
        currency: form.get("currency") || "LKR",
        sharesOutstanding: form.get("sharesOutstanding"),
        brandColor: form.get("brandColor") ?? "",
        logoBg: form.get("logoBg") || "transparent",
        published: form.get("published") === "true",
      });
      const dupe = await db.query.companies.findFirst({ where: d.id ? and(eq(companies.ticker, d.ticker), ne(companies.id, d.id)) : eq(companies.ticker, d.ticker) });
      if (dupe) throw new UserError(`Another company already uses the ticker ${d.ticker}.`);

      const before = d.id ? await db.query.companies.findFirst({ where: eq(companies.id, d.id) }) : null;
      if (d.id && !before) throw new UserError("Company not found.");
      const values = {
        name: d.name,
        ticker: d.ticker,
        slug: d.ticker.toLowerCase().replace(/\./g, "-"),
        sectorId: d.sectorId,
        description: d.description || null,
        website: d.website || null,
        currency: d.currency,
        sharesOutstanding: d.sharesOutstanding,
        brandColor: d.brandColor || null,
        logoBg: d.logoBg,
        status: d.published ? ("published" as const) : ("draft" as const),
        updatedAt: new Date(),
      };
      const [row] = before
        ? await db.update(companies).set(values).where(eq(companies.id, before.id)).returning()
        : await db.insert(companies).values(values).returning();

      // Logos: replace or remove, deleting the old file each time.
      const logo = form.get("logo");
      const logoDark = form.get("logoDark");
      const patch: Partial<typeof companies.$inferInsert> = {};
      if (logo instanceof File && logo.size > 0) {
        const s = await storeLogo(row.id, logo, "logo");
        patch.logoUrl = s.url;
        patch.logoShape = s.shape;
        await deleteFile(before?.logoUrl);
      } else if (form.get("removeLogo") === "true") {
        patch.logoUrl = null;
        patch.logoDarkUrl = null;
        await deleteFile(before?.logoUrl);
        await deleteFile(before?.logoDarkUrl);
      }
      if (logoDark instanceof File && logoDark.size > 0) {
        patch.logoDarkUrl = (await storeLogo(row.id, logoDark, "logo-dark")).url;
        await deleteFile(before?.logoDarkUrl);
      } else if (form.get("removeDarkLogo") === "true") {
        patch.logoDarkUrl = null;
        await deleteFile(before?.logoDarkUrl);
      }
      if (Object.keys(patch).length) await db.update(companies).set(patch).where(eq(companies.id, row.id));

      await audit(admin, before ? "company.updated" : "company.created", "company", row.id, before, { ...values, ...patch });
      revalidatePath("/admin/companies");
      revalidateCompany(row.slug);
      if (before && before.slug !== row.slug) revalidateCompany(before.slug);
      return { id: row.id, slug: row.slug };
    }, "Company saved.");
  } catch (err) {
    if (err instanceof LogoError) return { ok: false, error: `${err.title}: ${err.message}` };
    throw err;
  }
}

const priceSchema = z.object({
  companyId: z.string().uuid(),
  price: z.coerce.number().positive("Enter a price above zero.").max(1e7),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a trading date."),
});

/** One closing price. The latest close becomes the current price; the upside updates, the target does not. */
export async function savePrice(input: z.input<typeof priceSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin("prices.write");
    const d = priceSchema.parse(input);
    if (d.date > new Date().toISOString().slice(0, 10)) throw new UserError("The trading date cannot be in the future.");
    await db
      .insert(priceHistory)
      .values({ companyId: d.companyId, date: d.date, price: d.price, source: "manual" })
      .onConflictDoUpdate({ target: [priceHistory.companyId, priceHistory.date], set: { price: d.price, source: "manual" } });
    const company = await syncCurrentPrice(d.companyId);
    await audit(admin, "price.saved", "company", d.companyId, null, d);
    revalidatePath("/admin/companies");
    revalidateCompany(company?.slug);
  }, "Price saved.");
}

/** Make companies.current_price follow the newest stored close. */
async function syncCurrentPrice(companyId: string) {
  const [latest] = await db.select().from(priceHistory).where(eq(priceHistory.companyId, companyId)).orderBy(desc(priceHistory.date)).limit(1);
  if (!latest) return null;
  const [row] = await db
    .update(companies)
    .set({ currentPrice: latest.price, priceUpdatedAt: new Date(latest.date + "T12:00:00Z"), updatedAt: new Date() })
    .where(eq(companies.id, companyId))
    .returning();
  return row;
}

/** CSV import of closes: dry run returns a preview with warnings; commit inserts new dates only. */
export async function importPrices(companyId: string, csv: string, commit: boolean): Promise<ActionResult<CsvPreview>> {
  return run(async () => {
    const admin = await requireAdmin("prices.write");
    if (csv.length > 2_000_000) throw new UserError("The CSV is too large (2 MB maximum).");
    const existing = await db.select({ date: priceHistory.date, price: priceHistory.price }).from(priceHistory).where(eq(priceHistory.companyId, companyId));
    const preview = parsePriceCsv(csv, existing);
    if (preview.errors.length && commit) throw new UserError(preview.errors[0]);
    if (commit && preview.fresh.length) {
      for (let i = 0; i < preview.fresh.length; i += 500) {
        await db
          .insert(priceHistory)
          .values(preview.fresh.slice(i, i + 500).map((r) => ({ companyId, date: r.date, price: r.close, source: "csv" })))
          .onConflictDoNothing();
      }
      const company = await syncCurrentPrice(companyId);
      await audit(admin, "price.imported", "company", companyId, null, { rows: preview.fresh.length, skipped: preview.skipped });
      revalidatePath("/admin/companies");
      revalidateCompany(company?.slug);
    }
    return preview;
  }, commit ? "Prices imported." : undefined);
}

/** Recent closes for the update-price dialog. */
export async function recentPrices(companyId: string) {
  await requireAdmin();
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({ date: priceHistory.date, price: priceHistory.price, source: priceHistory.source })
    .from(priceHistory)
    .where(and(eq(priceHistory.companyId, companyId), gte(priceHistory.date, since)))
    .orderBy(desc(priceHistory.date))
    .limit(60);
}
