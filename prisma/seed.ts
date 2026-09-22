import { loadEnvConfig } from "@next/env";
import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { invoicePdf } from "../scripts/fixtures";
loadEnvConfig(process.cwd());
const db = new PrismaClient();
const id = (label: string) => { const hash = createHash("sha256").update(`clerq-demo:${label}`).digest("hex"); return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`; };
async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  let userId = process.env.SEED_USER_ID;
  if (!userId) {
    const existing = await db.user.findUnique({ where: { email: "clerq-demo@example.test" } });
    if (existing) userId = existing.id;
    else {
      const result = await admin.auth.admin.createUser({ email: "clerq-demo@example.test", password: process.env.SEED_PASSWORD || randomUUID(), email_confirm: true, user_metadata: { name: "Demo bookkeeper" } });
      if (result.error || !result.data.user) throw new Error("Unable to create demo identity. Set SEED_USER_ID to an existing Supabase user UUID.");
      userId = result.data.user.id;
    }
  }
  const authUser = await admin.auth.admin.getUserById(userId);
  if (authUser.error || !authUser.data.user?.email) throw new Error("SEED_USER_ID must refer to a real Supabase Auth user.");
  await db.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, email: authUser.data.user.email, name: "Demo bookkeeper" } });
  const org = await db.organization.upsert({ where: { slug: "clerq-demo" }, update: {}, create: { id: id("org"), name: "Clerq Demo Agency", slug: "clerq-demo", baseCurrency: "USD", memberships: { create: { userId, role: "OWNER" } } } });
  const owner = await db.membership.findUnique({ where: { userId_orgId: { userId, orgId: org.id } } });
  if (!owner) throw new Error("Existing demo organisation belongs to another user; seed did not change it.");
  const vendors = ["Stripe", "Zoom", "Adobe", "Figma", "Notion", "Canva", "Dropbox", "Slack", "GitHub", "Microsoft"];
  const date = new Date(); date.setUTCDate(10); date.setUTCHours(0, 0, 0, 0);
  for (let index = 0; index < 10; index++) await db.bankTransaction.upsert({ where: { id: id(`bank-${index}`) }, update: {}, create: { id: id(`bank-${index}`), orgId: org.id, transactionDate: date, rawDescription: `POS PURCHASE ${vendors[index]}`, counterpartyName: vendors[index], amount: String(100 + index), type: "DEBIT", currency: "USD", importKey: `seed:${index}` } });
  for (let index = 0; index < 8; index++) {
    const receiptId = id(`receipt-${index}`);
    if (await db.receipt.findUnique({ where: { id: receiptId } })) continue;
    const vendor = index < 5 ? vendors[index] : `Unlinked vendor ${index}`;
    const amount = String(index < 5 ? 100 + index : 900 + index);
    const buffer = invoicePdf(vendor, amount, date.toISOString().slice(0, 10));
    const path = `${org.id}/${receiptId}.pdf`;
    const uploaded = await admin.storage.from("receipts-vault").upload(path, buffer, { contentType: "application/pdf", upsert: false });
    if (uploaded.error && uploaded.error.message !== "The resource already exists") throw new Error("Seed receipt upload failed.");
    await db.receipt.create({ data: { id: receiptId, orgId: org.id, uploadedByUserId: userId, source: "WEB_UPLOAD", rawFileUrl: path, mimeType: "application/pdf", fileSizeBytes: buffer.length, vendorName: vendor, transactionDate: date, totalAmount: amount, taxAmount: "0", currency: "USD", category: "SOFTWARE", confidenceScore: 1, status: "UNMATCHED", rawExtractionJson: { seeded: true }, ingestionKey: `seed:${index}` } });
  }
  console.log("Seed complete: clerq-demo, 10 bank transactions, 8 receipts, 5 exact pairs and 3 unlinked receipts. Existing records preserved.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
