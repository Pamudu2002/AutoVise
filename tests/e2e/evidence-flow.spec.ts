import path from "node:path";
import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { writeEvidenceFixture } from "../../scripts/make-evidence-fixture";

/**
 * Customer evidence (docs/PLAN2.md): study from the demo template → import spreadsheet → AI-assisted
 * coding (offline rules when EVIDENCE_AI_MOCK=1 or Gemini is not configured) → accept suggestions →
 * QA by a second admin → matrix → finding blocked by the guard, fixed and approved → public appendix
 * and pitch show it.
 * Needs a seeded database and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD for a super-admin.
 */

// Each study tab is a new route; a dev server compiles it on first visit.
const expect = baseExpect.configure({ timeout: 90_000 });

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@autovise.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "";
const stamp = Date.now().toString().slice(-6);
const title = `E2E evidence study ${stamp}`;
const checker = { name: `QA Checker ${stamp}`, email: `qa.${stamp}@autovise.local`, password: `Checker-${stamp}-pass1` };
const today = new Date().toISOString().slice(0, 10);
// Letters only: the guard rejects any number that is not in the theme matrix.
const tag = stamp.replace(/\d/g, (d) => "abcdefghij"[Number(d)]);
const safeFinding = `In this exploratory sample, several Serendib app reviews on Google Play describe the night-time data split as poor value (run ${tag}).`;

async function signIn(page: Page, user: string, pass: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Work email").fill(user);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Generous: the first sign-in compiles the admin routes on a dev server.
  await expect(page).toHaveURL(/\/admin$/, { timeout: 120_000 });
}

async function checkerPage(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, checker.email, checker.password);
  return page;
}

test.describe.configure({ mode: "serial" });
test.skip(!password, "SEED_ADMIN_PASSWORD is not set");

let studyUrl = "";

test("an admin builds a study from the template and imports the spreadsheet", async ({ page }, info) => {
  await signIn(page, email, password);

  // A second admin for the QA check (the coder cannot check their own records).
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "New user" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(checker.name);
  await dialog.getByLabel("Work email").fill(checker.email);
  await dialog.getByLabel("Role", { exact: true }).selectOption("admin");
  await dialog.getByLabel("Starting password").fill(checker.password);
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText(checker.email)).toBeVisible();

  await page.goto("/admin/companies/stel/evidence");
  await page.getByRole("button", { name: "New study" }).first().click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Collection date").fill(today);
  await page.getByLabel("Template").selectOption("telecom-sl-demo");
  await page.getByRole("button", { name: "Create study" }).click();
  await expect(page).toHaveURL(/\/admin\/evidence\/[0-9a-f-]{36}$/);
  studyUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Screening came from the template.
  await page.getByRole("link", { name: "Screening" }).click();
  await expect(page.getByRole("group", { name: "Google Maps" }).getByLabel(/Reason/)).toHaveValue("Branch experience is not a research question in this study.");

  // Import: a fresh fixture dated today, so every row is inside the window.
  const file = path.join(info.outputDir, "evidence-sample.xlsx");
  const rows = writeEvidenceFixture(file, today, 3);
  await page.goto(`${studyUrl}/records/import`);
  await page.getByLabel("Spreadsheet file").setInputFiles(file);
  await expect(page.getByText(`${rows} rows`)).toBeVisible();
  await page.getByRole("button", { name: "Check rows" }).click();
  await expect(page.getByText("Check results")).toBeVisible();
  await page.getByRole("button", { name: /^Import \d+ records$/ }).click();
  await expect(page).toHaveURL(/\/records\?imported=/);
  await expect(page.getByRole("button", { name: "R001" })).toBeVisible();
});

test("AI-assisted suggestions are accepted by a person", async ({ page }) => {
  await signIn(page, email, password);
  await page.goto(`${studyUrl}/coding`);
  await page.getByRole("button", { name: /Suggest coding for \d+ uncoded/ }).click();
  await expect(page.getByRole("button", { name: "Accept coding" }).first()).toBeVisible({ timeout: 60_000 });
  // Accept every suggestion (the offline coder flags nothing in this fixture).
  const accept = page.getByRole("button", { name: "Accept coding" });
  for (let left = await accept.count(); left > 0; left--) {
    await accept.first().click();
    await expect(accept).toHaveCount(left - 1);
  }
  await page.goto(`${studyUrl}/analysis`);
  await expect(page.getByRole("heading", { name: "Theme matrix" })).toBeVisible();
  await expect(page.getByText(/Mobile · Google Play · App reviews/)).toBeVisible();
  await expect(page.getByText(/n = \d+ · \d+ threads? · \d+ contributors?/).first()).toBeVisible();
});

test("the guard blocks an overreaching finding until it is fixed", async ({ page }) => {
  await signIn(page, email, password);
  await page.goto(`${studyUrl}/findings`);
  const q1 = page.locator("section").filter({ has: page.getByRole("heading", { name: /value-for-money/ }) });
  await q1.getByRole("button", { name: "Write finding" }).click();
  await q1.getByLabel("Finding").fill("Most customers think Serendib data packages are poor value.");
  await q1.getByLabel("Cited records").fill("R003, R005");
  await q1.getByRole("button", { name: "Save and check" }).click();
  await expect(q1.locator('[aria-label="Guard warnings"]')).toContainText(/most customers/i);
  await expect(q1.getByRole("button", { name: "Approve" })).toBeDisabled();

  await q1.getByRole("button", { name: "Edit" }).click();
  await q1.getByLabel("Finding").fill(safeFinding);
  await q1.getByRole("button", { name: "Save and check" }).click();
  await expect(q1.getByText(safeFinding)).toBeVisible();
  await expect(q1.locator('[aria-label="Guard warnings"]')).toHaveCount(0);
});

test("a second admin checks the QA sample and approves the finding", async ({ browser }) => {
  const page = await checkerPage(browser);
  await page.goto(`${studyUrl}/qa`);
  const submit = page.getByRole("button", { name: "Submit check" });
  await expect(submit.first()).toBeVisible();
  for (let left = await submit.count(); left > 0; left--) {
    await submit.first().click();
    await expect(submit).toHaveCount(left - 1);
  }
  await expect(page.getByText("Every record in the sample has been checked.")).toBeVisible();

  await page.goto(`${studyUrl}/findings`);
  const card = page.locator("article").filter({ hasText: safeFinding });
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card.getByText("Approved", { exact: true })).toBeVisible();

  await page.goto(`${studyUrl}/appendix`);
  await page.getByRole("switch", { name: "Public methodology appendix" }).click();
  await expect(page.getByRole("link", { name: "View public page" })).toBeVisible();
  await page.context().close();
});

test("the public appendix and the pitch show the approved finding", async ({ page }) => {
  await page.goto("/companies/stel/evidence");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(safeFinding)).toBeVisible();
  await expect(page.getByText("Predictions are model estimates, not financial advice.").first()).toBeVisible();
  // No contributor refs or links to individual posts.
  await expect(page.locator("body")).not.toContainText(/T0\d-C\d+/);
  await expect(page.locator('a[href*="reddit.com"], a[href*="play.google.com"]')).toHaveCount(0);

  await expect(async () => {
    await page.goto("/companies/stel");
    await expect(page.getByText("Customer evidence · exploratory")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByText(safeFinding)).toBeVisible();
});
