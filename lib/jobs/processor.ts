import "server-only";
import { z } from "zod";
import { Resend } from "resend";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailAddress, ReceivedEmailSchema } from "@/lib/email/resend";
import { MIME_EXTENSIONS, MAX_FILE_BYTES, readLimitedBody } from "@/lib/files";
import { downloadReceipt, storeReceipt } from "@/lib/receipts/service";
import { parseReceiptWithGroq } from "@/lib/ai/receipt-parser";

async function ingestEmail(payload: Prisma.JsonValue) {
  const event = ReceivedEmailSchema.parse({ type: "email.received", data: payload }).data;
  const recipients = event.received_for.length ? event.received_for : event.to;
  const organisations = await prisma.organization.findMany({ where: { inboundEmailAlias: { in: recipients.map(emailAddress) } } });
  if (!organisations.length) return;
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_NOT_CONFIGURED");
  const resend = new Resend(process.env.RESEND_API_KEY);
  for (const attachment of event.attachments) {
    if (!MIME_EXTENSIONS[attachment.content_type]) continue;
    const { data, error } = await resend.emails.receiving.attachments.get({ emailId: event.email_id, id: attachment.id });
    if (error || !data) throw new Error("RESEND_ATTACHMENT_UNAVAILABLE");
    if (data.size > MAX_FILE_BYTES) continue;
    // Download URLs come from the authenticated provider API, never the webhook.
    const url = new URL(data.download_url);
    if (url.protocol !== "https:") throw new Error("INVALID_ATTACHMENT_URL");
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: "error" });
    if (!response.ok) throw new Error("ATTACHMENT_DOWNLOAD_FAILED");
    const buffer = await readLimitedBody(response, MAX_FILE_BYTES);
    for (const org of organisations) {
      await storeReceipt({ buffer, mimeType: attachment.content_type, orgId: org.id, source: "EMAIL", ingestionKey: `resend:${event.email_id}:${attachment.id}` });
    }
  }
}

async function parseReceipt(payload: Prisma.JsonValue) {
  const { receiptId, orgId } = z.object({ receiptId: z.string().uuid(), orgId: z.string().uuid() }).parse(payload);
  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, orgId } });
  if (!receipt || receipt.status !== "PROCESSING") return;
  const buffer = await downloadReceipt(receipt.rawFileUrl, orgId);
  const extracted = await parseReceiptWithGroq(buffer, receipt.mimeType);
  await prisma.$transaction(async tx => {
    const updated = await tx.receipt.updateMany({ where: { id: receiptId, orgId, status: "PROCESSING" }, data: {
      ...extracted, transactionDate: new Date(`${extracted.transactionDate}T00:00:00Z`), rawExtractionJson: extracted,
      status: extracted.confidenceScore >= 0.7 ? "UNMATCHED" : "FLAGGED", notes: extracted.confidenceScore < 0.7 ? "LOW_CONFIDENCE" : null,
    } });
    if (updated.count) await tx.ingestionJob.upsert({ where: { key: `reconcile:${receiptId}` }, update: { status: "PENDING", availableAt: new Date() }, create: { key: `reconcile:${receiptId}`, type: "RECONCILE", payload: { orgId } } });
  });
}

export async function processNextJob(jobId?: string) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1000);
  const eligible = { OR: [{ status: "PENDING" as const, availableAt: { lte: now } }, { status: "RUNNING" as const, lockedAt: { lt: staleBefore } }] };
  const candidate = await prisma.ingestionJob.findFirst({ where: { ...eligible, ...(jobId ? { id: jobId } : {}) }, orderBy: { availableAt: "asc" } });
  if (!candidate) return false;
  const claimed = await prisma.ingestionJob.updateMany({ where: { id: candidate.id, ...eligible }, data: { status: "RUNNING", lockedAt: now, attempts: { increment: 1 } } });
  if (!claimed.count) return true;
  try {
    if (candidate.type === "EMAIL_INGEST") await ingestEmail(candidate.payload);
    else if (candidate.type === "RECEIPT_PARSE") await parseReceipt(candidate.payload);
    else {
      const { orgId } = z.object({ orgId: z.string().uuid() }).parse(candidate.payload);
      const { runReconciliation } = await import("@/lib/reconciliation/matcher");
      await runReconciliation(orgId);
    }
    await prisma.ingestionJob.updateMany({ where: { id: candidate.id, status: "RUNNING", lockedAt: now }, data: { status: "COMPLETED", lockedAt: null, lastError: null } });
  } catch (error) {
    const failed = candidate.attempts + 1 >= 5;
    const code = error instanceof Error ? error.message.slice(0, 200) : "PROCESSING_FAILED";
    await prisma.ingestionJob.updateMany({ where: { id: candidate.id, status: "RUNNING", lockedAt: now }, data: {
      status: failed ? "FAILED" : "PENDING", lockedAt: null, lastError: code,
      availableAt: new Date(Date.now() + Math.min(600000, 15000 * 2 ** candidate.attempts)),
    } });
    if (failed && candidate.type === "RECEIPT_PARSE") {
      const payload = z.object({ receiptId: z.string(), orgId: z.string() }).parse(candidate.payload);
      await prisma.receipt.updateMany({ where: { id: payload.receiptId, orgId: payload.orgId, status: "PROCESSING" }, data: { status: "FLAGGED", confidenceScore: 0.3, notes: "EXTRACTION_FAILED: review the original file and enter the fields manually." } });
    }
    console.error("Background job failed", { jobId: candidate.id, type: candidate.type, attempt: candidate.attempts + 1, code });
  }
  return true;
}
