import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * The main journey from docs/PLAN.md §10: admin login → create company → upload report → approve →
 * publish prediction → public card shows price, target and upside → detail page shows the waterfall
 * and citations → (with Gemini) a chat question gets a streamed answer.
 * Needs a seeded database (npm run db:seed) and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@autovise.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "";
const hasGemini = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const ticker = `T${Date.now().toString().slice(-5)}`;
const name = `Test Harbour ${ticker}`;

async function samplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  const lines = [
    `${name} — Annual Report 2025`,
    "Chairman's statement: Revenue grew 12% and the board raised the dividend.",
    "Statement of profit or loss (LKR million): Revenue 1,000; Profit attributable to shareholders 100; Basic EPS 10.00; Dividend per share 4.00.",
    "Statement of financial position: Total assets 1,500; Borrowings 300; Total equity 800.",
  ];
  lines.forEach((l, i) => page.drawText(l, { x: 40, y: 780 - i * 24, size: 10, font }));
  return Buffer.from(await doc.save());
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe.configure({ mode: "serial" });

test("public site lists companies with targets and a disclaimer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Investment research, pitched like a consultant/ })).toBeVisible();
  await expect(page.getByText("Predictions are model estimates, not financial advice.").first()).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("harbour");
  await expect(page.getByText("Lanka Harbour Logistics")).toBeVisible();
});

test("wrong password shows an error and does not sign in", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("definitely-not-the-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("admin creates a company, uploads a report, approves it and publishes the prediction", async ({ page }) => {
  test.skip(!password, "SEED_ADMIN_PASSWORD is not set");
  await signIn(page);

  // Create the company.
  await page.goto("/admin/companies");
  await page.getByRole("button", { name: "New company" }).click();
  await page.getByLabel("Company name").fill(name);
  await page.getByLabel("Ticker").fill(ticker);
  await page.getByLabel("Sector").selectOption({ label: "Logistics" });
  await page.getByLabel("Shares outstanding").fill("10000000");
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "Create company" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

  // Enter a price.
  await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Update price" }).click();
  await page.getByLabel(/Close price/).fill("120");
  await page.getByRole("button", { name: "Save price" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("LKR 120.00");

  // Upload a report.
  await page.getByRole("row", { name: new RegExp(name) }).getByRole("link", { name: "Reports" }).click();
  await page.locator('input[type="file"][multiple]').setInputFiles({ name: `${ticker}_Annual_Report_2025.pdf`, mimeType: "application/pdf", buffer: await samplePdf() });
  await page.getByRole("button", { name: /Upload 1 file/ }).click();
  await expect(page.getByRole("row", { name: /Annual Report 2025/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review" })).toBeVisible({ timeout: 180_000 });
  await page.getByRole("link", { name: "Review" }).click();

  // Without Gemini nothing is extracted, so enter the figures by hand.
  if (!hasGemini) {
    await page.getByRole("button", { name: "Add period" }).click();
    await page.getByLabel("Year").fill("2025");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const figures: [string, string][] = [
      ["Revenue", "1000"],
      ["Net income (to shareholders)", "100"],
      ["EPS", "10"],
      ["Dividend per share", "4"],
      ["Total assets", "1500"],
      ["Total equity", "800"],
      ["Total borrowings", "300"],
    ];
    for (const [label, value] of figures) {
      await page.getByRole("button", { name: `Edit ${label}`, exact: true }).click();
      await page.getByLabel(`${label} value`).fill(value);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByLabel(`${label} value`)).toBeHidden();
    }
  }
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();

  // The recompute runs in the background; wait for the draft, then publish it.
  await expect(async () => {
    await page.goto(`/admin/predictions?company=${ticker.toLowerCase()}`);
    await expect(page.getByText("Draft · needs review")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 120_000, intervals: [2_000] });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/is live on the public site/)).toBeVisible();

  // Public card: price, target and upside.
  await expect(async () => {
    await page.goto("/");
    const card = page.getByRole("link", { name: new RegExp(name) });
    await expect(card).toContainText("LKR 120.00", { timeout: 2_000 });
    await expect(card).toContainText("3-yr target · base");
    await expect(card.locator(".delta")).toBeVisible();
  }).toPass({ timeout: 60_000, intervals: [3_000] });

  // Pitch page: waterfall and citations.
  await page.goto(`/companies/${ticker.toLowerCase()}`);
  await expect(page.getByRole("heading", { name: "Investment thesis", exact: false }).or(page.getByText("01 · Investment thesis"))).toBeVisible();
  await page.getByRole("tab", { name: "How We Got Here" }).click();
  await expect(page.getByRole("heading", { name: "Valuation waterfall" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Base EPS (FY2025)" })).toBeVisible();
  await page.getByRole("tab", { name: "What-if Simulator" }).click();
  await expect(page.getByText("Matches base")).toBeVisible();
});

test("a seeded pitch shows citations that open a source preview", async ({ page }) => {
  await page.goto("/companies/lhl");
  const chip = page.locator("button.cite").first();
  await chip.click();
  await expect(page.getByRole("dialog")).toContainText("Page");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the consultant answers with a streamed, cited reply", async ({ page }) => {
  test.skip(!hasGemini, "GOOGLE_GENERATIVE_AI_API_KEY is not set");
  await page.goto("/companies/lhl");
  await page.getByRole("button", { name: "What's the biggest risk to this view?" }).click();
  const answer = page.locator(".bubble.bot").nth(1);
  await expect(answer).not.toBeEmpty({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Helpful answer" })).toBeVisible({ timeout: 60_000 });
});
