import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import JSZip from "jszip";
import { invoicePdf } from "./fixtures";
loadEnvConfig(process.cwd());

async function main() {
  const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!base.startsWith("https://")) throw new Error("An HTTPS deployment URL is required.");
  const { prisma } = await import("../lib/prisma");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const suffix = randomUUID();
  let userId: string | undefined, orgId: string | undefined;
  const paths: string[] = [];
  const email = `clerq-deployment-${suffix}@example.test`, password = `${randomUUID()}Aa1!`;
  const request = (path: string, init?: RequestInit) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60000) });
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("Disposable Auth identity could not be created.");
    userId = created.data.user.id;
    await prisma.user.create({ data: { id: userId, email } });
    const org = await prisma.organization.create({ data: { name: "Deployment check", slug: `deploy-${suffix}`, baseCurrency: "USD", memberships: { create: { userId, role: "OWNER" } } } });
    orgId = org.id;
    const jar = new Map<string, string>();
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cookies => cookies.forEach(({ name, value }) => jar.set(name, value)) } });
    assert.equal((await auth.auth.signInWithPassword({ email, password })).error, null);
    const headers = { Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "), "content-type": "application/json" };
    assert.equal((await request(`/dashboard/${org.slug}`, { headers })).status, 200);
    console.log("PASS deployed authenticated dashboard and database access");
    const date = new Date().toISOString().slice(0, 10);
    const pdf = Buffer.concat([invoicePdf("Stripe", "29.95", date), Buffer.alloc(5 * 1024 * 1024, 32)]);
    await prisma.bankTransaction.create({ data: { orgId, transactionDate: new Date(date), rawDescription: "Stripe", counterpartyName: "Stripe", amount: "29.95", currency: "USD", type: "DEBIT" } });
    const prepared = await request("/api/receipts/upload", { method: "POST", headers, body: JSON.stringify({ orgSlug: org.slug, mimeType: "application/pdf", size: pdf.length }) });
    assert.equal(prepared.status, 200, "Deployed signed upload route");
    const target = await prepared.json(); paths.push(target.path);
    assert.ok((await fetch(target.signedUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: new Uint8Array(pdf), signal: AbortSignal.timeout(60000) })).ok);
    const complete = await request("/api/receipts/upload/complete", { method: "POST", headers, body: JSON.stringify({ orgSlug: org.slug, path: target.path, mimeType: "application/pdf" }) });
    assert.equal(complete.status, 202, "Deployed upload finalisation");
    const { receiptId } = await complete.json();
    console.log("PASS deployed direct receipt upload larger than 5 MB");
    const deadline = Date.now() + 300000;
    let matched = false;
    while (Date.now() < deadline) {
      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
      if (receipt.status === "MATCHED") { matched = true; break; }
      if (receipt.status === "FLAGGED") throw new Error("Synthetic receipt was flagged; inspect extraction before marking live processing verified.");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    assert.ok(matched, "Vercel Queues must extract and automatically reconcile without a local worker");
    console.log("PASS Vercel queue extraction and automatic reconciliation");
    const { CanvasFactory, getPath } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    PDFParse.setWorker(getPath());
    const renderer = new PDFParse({ data: new Uint8Array(invoicePdf("Zoom", "19.95", date)), CanvasFactory });
    let png: Uint8Array;
    try { png = (await renderer.getScreenshot({ first: 1, scale: 2 })).pages[0].data; }
    finally { await renderer.destroy(); }
    await prisma.bankTransaction.create({ data: { orgId, transactionDate: new Date(date), rawDescription: "Zoom", counterpartyName: "Zoom", amount: "19.95", currency: "USD", type: "DEBIT" } });
    const imagePrepared = await request("/api/receipts/upload", { method: "POST", headers, body: JSON.stringify({ orgSlug: org.slug, mimeType: "image/png", size: png.length }) });
    assert.equal(imagePrepared.status, 200);
    const imageTarget = await imagePrepared.json(); paths.push(imageTarget.path);
    assert.ok((await fetch(imageTarget.signedUrl, { method: "PUT", headers: { "content-type": "image/png" }, body: new Uint8Array(png), signal: AbortSignal.timeout(60000) })).ok);
    const imageComplete = await request("/api/receipts/upload/complete", { method: "POST", headers, body: JSON.stringify({ orgSlug: org.slug, path: imageTarget.path, mimeType: "image/png" }) });
    assert.equal(imageComplete.status, 202);
    const imageReceiptId = (await imageComplete.json()).receiptId;
    const imageDeadline = Date.now() + 300000;
    let imageMatched = false;
    while (Date.now() < imageDeadline) {
      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: imageReceiptId } });
      if (receipt.status === "MATCHED") { imageMatched = true; break; }
      if (receipt.status === "FLAGGED") throw new Error("Synthetic image was flagged during cloud OCR.");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    assert.ok(imageMatched, "Vercel must OCR and reconcile the image receipt");
    console.log("PASS deployed image OCR, extraction and automatic matching");
    const original = await request(`/api/receipts/${receiptId}?orgSlug=${org.slug}`, { headers });
    assert.equal(original.status, 200);
    assert.ok(Buffer.from(await original.arrayBuffer()).equals(pdf));
    const exported = await request(`/api/export/tax-pack?orgSlug=${org.slug}&month=${date.slice(0, 7)}`, { headers });
    assert.equal(exported.status, 200);
    const zip = await JSZip.loadAsync(await exported.arrayBuffer());
    const file = Object.values(zip.files).find(entry => entry.name.endsWith(".pdf"));
    assert.ok(file);
    assert.ok((await file.async("nodebuffer")).equals(pdf));
    const imageFile = Object.values(zip.files).find(entry => entry.name.endsWith(".png"));
    assert.ok(imageFile);
    assert.ok((await imageFile.async("nodebuffer")).equals(Buffer.from(png)));
    console.log("PASS deployed original-file streaming and tax-pack export");
  } finally {
    if (orgId) {
      const receipts = await prisma.receipt.findMany({ where: { orgId }, select: { rawFileUrl: true } });
      paths.push(...receipts.map(receipt => receipt.rawFileUrl));
      await prisma.ingestionJob.deleteMany({ where: { payload: { path: ["orgId"], equals: orgId } } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (paths.length) await admin.storage.from("receipts-vault").remove(paths);
    if (userId) { await prisma.user.deleteMany({ where: { id: userId } }); await admin.auth.admin.deleteUser(userId); }
    await prisma.$disconnect();
    console.log("Disposable deployment fixtures removed; no email sent");
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Deployment test failed"); process.exitCode = 1; });
