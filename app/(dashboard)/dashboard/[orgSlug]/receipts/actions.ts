"use server";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExtractedReceiptSchema } from "@/lib/ai/extraction-schema";
import { lockOrganisation } from "@/lib/reconciliation/matcher";
import { randomUUID } from "node:crypto";
import { dispatchPendingJobs } from "@/lib/jobs/dispatch";

export async function saveReceiptReview(orgSlug: string, receiptId: string, form: FormData) {
  try {
    const { organization, user } = await requireMembership(orgSlug);
    const extracted = ExtractedReceiptSchema.safeParse({ vendorName: form.get("vendorName"), transactionDate: form.get("transactionDate"), totalAmount: form.get("totalAmount") === "" ? null : Number(form.get("totalAmount")), taxAmount: form.get("taxAmount") ? Number(form.get("taxAmount")) : null, currency: String(form.get("currency") ?? "").toUpperCase(), category: form.get("category"), confidenceScore: 1 });
    if (!extracted.success) return { error: "Enter a valid vendor, date, non-negative total, currency and tax amount." };
    await prisma.$transaction(async tx => {
      await lockOrganisation(tx, organization.id);
      const updated = await tx.receipt.updateMany({ where: { id: receiptId, orgId: organization.id, status: { not: "MATCHED" } }, data: { ...extracted.data, transactionDate: new Date(`${extracted.data.transactionDate}T00:00:00Z`), status: "UNMATCHED", notes: `Reviewed by ${user.id}` } });
      if (!updated.count) throw new Error("Receipt unavailable or already matched.");
      await tx.ingestionJob.create({ data: { key: `review:${randomUUID()}`, type: "RECONCILE", payload: { orgId: organization.id } } });
    });
    await dispatchPendingJobs(organization.id);
    revalidatePath(`/dashboard/${orgSlug}`, "layout");
    return { success: true };
  } catch { return { error: "Unable to save receipt. Matched receipts cannot be edited." }; }
}

export async function retryReceipt(orgSlug: string, receiptId: string) {
  try {
    const { organization } = await requireMembership(orgSlug);
    await prisma.$transaction(async tx => {
      await lockOrganisation(tx, organization.id);
      const receipt = await tx.receipt.findFirst({ where: { id: receiptId, orgId: organization.id, status: "FLAGGED" } });
      if (!receipt) throw new Error("Only flagged receipts can be retried.");
      const job = await tx.ingestionJob.findUnique({ where: { key: `parse:${receiptId}` } });
      if (job?.status === "RUNNING") throw new Error("Extraction is already running.");
      await tx.receipt.update({ where: { id: receiptId }, data: { status: "PROCESSING", notes: null } });
      await tx.ingestionJob.upsert({ where: { key: `parse:${receiptId}` }, create: { key: `parse:${receiptId}`, type: "RECEIPT_PARSE", payload: { receiptId, orgId: organization.id } }, update: { status: "PENDING", attempts: 0, lockedAt: null, availableAt: new Date(), lastError: null } });
    });
    await dispatchPendingJobs(organization.id);
    revalidatePath(`/dashboard/${orgSlug}`, "layout");
    return { success: true };
  } catch { return { error: "Unable to retry extraction. It may already be running." }; }
}
