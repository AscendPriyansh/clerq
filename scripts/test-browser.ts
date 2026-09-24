import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect as baseExpect, type Page } from "@playwright/test";
import { invoicePdf } from "./fixtures";
loadEnvConfig(process.cwd());
const expect = baseExpect.configure({ timeout: 60000 });

async function main() {
  const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const url = new URL(base);
  const regressionsOnly = process.argv.includes("--regressions-only");
  assert.ok(!(regressionsOnly && process.argv.includes("--direct-login")), "Auth regression checks must start from the homepage");
  assert.ok(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)), "Use HTTPS or a local development server");
  const { prisma } = await import("../lib/prisma");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  context.setDefaultTimeout(60000);
  context.setDefaultNavigationTimeout(120000);
  const page = await context.newPage();
  page.on("response", response => {
    if (response.url().includes("/auth/v1/token")) console.log(`Auth token response: ${response.status()}`);
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const paths = new Set<string>();
  page.on("response", async response => {
    if (response.url() === `${base}/api/receipts/upload` && response.ok()) {
      try { const data = await response.json(); if (typeof data.path === "string") paths.add(data.path); } catch {}
    }
  });
  const output = resolve(".artifacts/browser-check");
  await mkdir(output, { recursive: true });
  let userId: string | undefined, orgId: string | undefined;
  const suffix = randomUUID();
  const email = `clerq-browser-${suffix}@example.test`, password = `${randomUUID()}Aa1!`;
  async function navigate(label: string, heading: string) {
    const started = performance.now();
    await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    console.log(`PASS browser navigation ${label}: ${Math.round(performance.now() - started)} ms to visible heading`);
  }
  async function checkWidth(target: Page, label: string) {
    const width = await target.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    assert.ok(width.content <= width.viewport + 1, `${label} has page-level horizontal overflow: ${width.content}/${width.viewport}`);
  }
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("Unable to create disposable browser identity");
    userId = created.data.user.id;
    await prisma.user.create({ data: { id: userId, email } });
    const org = await prisma.organization.create({ data: { name: "Browser check", slug: `browser-${suffix}`, baseCurrency: "AUD", memberships: { create: { userId, role: "OWNER" } } } });
    orgId = org.id;
    await page.goto(base);
    await expect(page.getByRole("heading", { name: "Receipts and bank transactions, brought together." })).toBeVisible();
    await page.getByText("Which receipt files can I upload?", { exact: true }).click();
    await expect(page.getByText(/PDF, PNG, JPEG and WebP files up to 10 MB/)).toBeVisible();
    await checkWidth(page, "Desktop homepage");
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    // Diagnostic mode isolates workspace flows from the known pre-login prefetch regression.
    if (process.argv.includes("--direct-login")) await page.goto(`${base}/login`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(`${base}/dashboard/${org.slug}`, { timeout: 90000 });
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    console.log("PASS browser homepage, FAQ and password sign-in (no emails sent)");
    const date = new Date().toISOString().slice(0, 10);
    if (!regressionsOnly) {
      await navigate("Receipts", "Receipts vault");
      await page.getByLabel("Choose receipt files").setInputFiles({ name: "browser-check.pdf", mimeType: "application/pdf", buffer: invoicePdf("Stripe", "29.95", date) });
      await expect(page.getByText("browser-check.pdf saved. Extraction will appear below when ready.", { exact: true })).toBeVisible();
      console.log("PASS browser signed upload and saved-state feedback");
    }
    await navigate("Transactions", "Transactions");
    await page.getByLabel("Choose bank CSV").setInputFiles({ name: "browser-bank.csv", mimeType: "text/csv", buffer: Buffer.from(`Date,Description,Amount\n${date},Stripe,-29.95\n`) });
    await page.getByLabel("Currency", { exact: true }).fill("USD");
    await page.getByLabel("Date order", { exact: true }).selectOption("MDY");
    await page.getByLabel("Single amount column", { exact: true }).selectOption("false");
    await page.getByRole("button", { name: "Import transactions", exact: true }).click();
    await expect(page.getByText(/Imported 1 transactions, skipped 0 duplicates, 0 invalid rows/)).toBeVisible();
    await expect(page.getByLabel("Date", { exact: true })).toHaveValue("Date");
    await expect(page.getByLabel("Currency", { exact: true })).toHaveValue("USD");
    await expect(page.getByLabel("Date order", { exact: true })).toHaveValue("MDY");
    await expect(page.getByLabel("Single amount column", { exact: true })).toHaveValue("false");
    // Import again to verify the browser preserves the mapping and reports duplicates.
    await page.getByRole("button", { name: "Import transactions", exact: true }).click();
    await expect(page.getByText(/Imported 0 transactions, skipped 1 duplicates, 0 invalid rows/)).toBeVisible();
    console.log("PASS browser CSV mapping/import and duplicate feedback");
    if (regressionsOnly) {
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto(`${base}/dashboard/${org.slug}`);
      await expect(page).toHaveURL(/\/login/);
      assert.deepEqual(errors, [], "No uncaught browser JavaScript errors");
      console.log("PASS desktop auth and CSV regressions only; other passed workflows not rerun");
      return;
    }
    await expect.poll(async () => {
      if (["localhost", "127.0.0.1"].includes(url.hostname)) {
        // Local servers do not publish to Vercel Queues. Process only this fixture's jobs.
        const { processNextJob } = await import("../lib/jobs/processor");
        const jobs = await prisma.ingestionJob.findMany({ where: { status: "PENDING", payload: { path: ["orgId"], equals: orgId } }, select: { id: true } });
        for (const job of jobs) await processNextJob(job.id);
      }
      return prisma.receipt.count({ where: { orgId, status: "MATCHED" } });
    }, { timeout: 180000, intervals: [3000] }).toBe(1);
    await navigate("Reconcile", "Reconcile");
    await page.getByRole("button", { name: "Run reconciliation", exact: true }).click();
    await expect(page.getByText(/\d+ exact matches; \d+ suggestions\./)).toBeVisible();
    await page.getByRole("combobox").nth(0).selectOption("RECONCILED");
    await expect(page).toHaveURL(/bankStatus=RECONCILED/);
    await expect(page.getByRole("table").first().getByText("Stripe", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run reconciliation", exact: true })).toBeEnabled();
    await page.screenshot({ path: resolve(output, "desktop-reconciliation.png"), fullPage: true });
    console.log("PASS browser reconciliation action and server-side status filter");
    await navigate("Overview", "Overview");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download tax pack", exact: true }).click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    assert.match(download.suggestedFilename(), /^clerq-taxpack-.*\.zip$/);
    await expect(page.getByText("Tax pack downloaded.", { exact: true })).toBeVisible();
    console.log("PASS browser ZIP download and success feedback");
    await navigate("Settings", "Settings");
    await expect(page.getByText("Browser check", { exact: true }).last()).toBeVisible();
    await checkWidth(page, "Desktop settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto(`${base}/dashboard/${org.slug}`);
    await expect(page).toHaveURL(/\/login/);
    assert.deepEqual(errors, [], "No uncaught browser JavaScript errors");
    console.log("PASS browser sign-out, protected navigation and JavaScript error checks");
  } catch (error) {
    console.log("Browser cookie names:", (await context.cookies()).map(cookie => cookie.name));
    await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
    if (orgId) {
      const receipts = await prisma.receipt.findMany({ where: { orgId }, select: { rawFileUrl: true } });
      receipts.forEach(row => paths.add(row.rawFileUrl));
      await prisma.ingestionJob.deleteMany({ where: { payload: { path: ["orgId"], equals: orgId } } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (paths.size) { const removed = await admin.storage.from("receipts-vault").remove([...paths]); if (removed.error) throw new Error("Browser fixture file cleanup failed"); }
    if (userId) { await prisma.user.deleteMany({ where: { id: userId } }); await admin.auth.admin.deleteUser(userId); }
    await prisma.$disconnect();
    console.log("Disposable browser fixtures removed; no email sent");
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Browser check failed"); process.exitCode = 1; });
