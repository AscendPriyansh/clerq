"use server";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commitMatch, lockOrganisation, runReconciliation } from "@/lib/reconciliation/matcher";
import { AppError } from "@/lib/errors";

export async function matchRecords(orgSlug: string, receiptId: string, bankTransactionId: string, manual: boolean, notes?: string) {
  try {
    const { user, organization } = await requireMembership(orgSlug);
    await commitMatch({ orgId: organization.id, userId: user.id, receiptId, bankTransactionId, manual, notes });
    revalidatePath(`/dashboard/${orgSlug}`, "layout");
    return { success: true };
  } catch (error) { return { error: error instanceof AppError ? error.message : "Unable to match these records. Refresh and try again." }; }
}
export async function reconcileNow(orgSlug: string) {
  try {
    const { organization } = await requireMembership(orgSlug);
    const result = await runReconciliation(organization.id);
    revalidatePath(`/dashboard/${orgSlug}`, "layout");
    return { exactMatches: result.exactMatches, suggestions: result.suggestedMatches.length };
  } catch { return { error: "Reconciliation failed. Please try again." }; }
}
export async function dismissSuggestion(orgSlug: string, receiptId: string, bankTransactionId: string) {
  try {
    const { organization } = await requireMembership(orgSlug);
    await prisma.$transaction(async tx => {
      await lockOrganisation(tx, organization.id);
      const receipt = await tx.receipt.findFirst({ where: { id: receiptId, orgId: organization.id, status: { not: "MATCHED" } } });
      const transaction = await tx.bankTransaction.findFirst({ where: { id: bankTransactionId, orgId: organization.id, isReconciled: false } });
      if (!receipt || !transaction) throw new Error("This pair is no longer available.");
      await tx.dismissedMatch.upsert({ where: { orgId_receiptId_bankTransactionId: { orgId: organization.id, receiptId, bankTransactionId } }, update: {}, create: { orgId: organization.id, receiptId, bankTransactionId } });
    });
    await runReconciliation(organization.id);
    revalidatePath(`/dashboard/${orgSlug}`, "layout");
    return { success: true };
  } catch { return { error: "Unable to dismiss the suggestion. Refresh and try again." }; }
}
export async function flagMissingReceipt(orgSlug: string, bankTransactionId: string) {
  try {
    const { organization } = await requireMembership(orgSlug);
    const result = await prisma.bankTransaction.updateMany({ where: { id: bankTransactionId, orgId: organization.id, isReconciled: false, type: "DEBIT" }, data: { notes: "MISSING_RECEIPT" } });
    if (!result.count) return { error: "Choose an unreconciled debit." };
    revalidatePath(`/dashboard/${orgSlug}`, "layout");
    return { success: true };
  } catch { return { error: "Unable to flag this transaction." }; }
}
