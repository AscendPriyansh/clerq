import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { comparePair, planMatches } from "./core";
export { normalizeVendorName, jaroWinklerSimilarity, daysBetween } from "./core";

export async function lockOrganisation(tx: Prisma.TransactionClient, orgId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${orgId}))`;
}
async function loadCandidates(tx: Prisma.TransactionClient, orgId: string) {
  const [transactions, receipts, dismissals] = await Promise.all([
    tx.bankTransaction.findMany({ where: { orgId, type: "DEBIT", isReconciled: false }, orderBy: { id: "asc" }, select: { id: true, counterpartyName: true, transactionDate: true, amount: true, currency: true } }),
    tx.receipt.findMany({ where: { orgId, status: { in: ["UNMATCHED", "PARSED", "FLAGGED"] }, confidenceScore: { gte: 0.7 }, totalAmount: { not: null }, transactionDate: { not: null } }, orderBy: { id: "asc" }, select: { id: true, vendorName: true, transactionDate: true, totalAmount: true, currency: true, confidenceScore: true } }),
    tx.dismissedMatch.findMany({ where: { orgId }, select: { receiptId: true, bankTransactionId: true } }),
  ]);
  const plan = planMatches(receipts, transactions, new Set(dismissals.map(row => `${row.receiptId}:${row.bankTransactionId}`)));
  return { transactions, receipts, plan };
}
export async function runReconciliation(orgId: string) {
  return prisma.$transaction(async tx => {
    await lockOrganisation(tx, orgId);
    const { plan, transactions, receipts } = await loadCandidates(tx, orgId);
    for (const pair of plan.exact) {
      await tx.reconciliationRecord.create({ data: { orgId, receiptId: pair.receiptId, bankTransactionId: pair.bankTransactionId, matchType: "EXACT_AUTOMATIC", confidenceScore: 1 } });
      await tx.bankTransaction.update({ where: { id: pair.bankTransactionId }, data: { isReconciled: true, notes: null } });
      await tx.receipt.update({ where: { id: pair.receiptId }, data: { status: "MATCHED", notes: null } });
    }
    const suggestedIds = [...new Set(plan.suggestions.map(pair => pair.receiptId))];
    await tx.receipt.updateMany({ where: { orgId, id: { in: suggestedIds }, status: { not: "MATCHED" } }, data: { status: "FLAGGED", notes: "SUGGESTED_MATCH" } });
    await tx.receipt.updateMany({ where: { orgId, id: { in: receipts.map(row => row.id), notIn: suggestedIds }, status: { not: "MATCHED" } }, data: { status: "UNMATCHED", notes: "UNLINKED_INVOICE" } });
    await tx.bankTransaction.updateMany({ where: { orgId, id: { in: transactions.map(row => row.id) }, isReconciled: false, notes: null }, data: { notes: "MISSING_RECEIPT" } });
    return { exactMatches: plan.exact.length, suggestedMatches: plan.suggestions, unmatchedTransactions: plan.unmatchedTransactions, unmatchedReceipts: plan.unmatchedReceipts };
  }, { timeout: 60000 });
}

export async function getSuggestions(orgId: string) {
  const { plan, transactions, receipts } = await loadCandidates(prisma, orgId);
  const bankNames = new Map(transactions.map(row => [row.id, row.counterpartyName]));
  const receiptNames = new Map(receipts.map(row => [row.id, row.vendorName]));
  // Read-only: exact candidates awaiting the worker can also be reviewed.
  return [...plan.exact, ...plan.suggestions].map(pair => ({ ...pair, bankName: bankNames.get(pair.bankTransactionId) ?? "Bank transaction", receiptName: receiptNames.get(pair.receiptId) ?? "Receipt" }));
}

export async function commitMatch(input: { orgId: string; receiptId: string; bankTransactionId: string; userId: string; manual: boolean; notes?: string }) {
  return prisma.$transaction(async tx => {
    await lockOrganisation(tx, input.orgId);
    const membership = await tx.membership.findUnique({ where: { userId_orgId: { userId: input.userId, orgId: input.orgId } } });
    if (!membership) throw new AppError("Organisation access denied.", "FORBIDDEN", 403);
    const [receipt, transaction] = await Promise.all([
      tx.receipt.findFirst({ where: { id: input.receiptId, orgId: input.orgId } }),
      tx.bankTransaction.findFirst({ where: { id: input.bankTransactionId, orgId: input.orgId } }),
    ]);
    if (!receipt || !transaction) throw new AppError("Match records were not found.", "NOT_FOUND", 404);
    if (receipt.status === "MATCHED" || transaction.isReconciled) throw new AppError("One of these records is already matched. Refresh the page.", "MATCH_CONFLICT", 409);
    if (transaction.type !== "DEBIT" || receipt.currency !== transaction.currency || receipt.totalAmount === null || !receipt.transactionDate || !receipt.vendorName) throw new AppError("Choose a debit and a reviewed receipt in the same currency.", "INVALID_MATCH");
    const suggestion = comparePair(receipt, transaction);
    if (!input.manual && (!suggestion || receipt.confidenceScore < 0.7)) throw new AppError("This pair no longer qualifies as a suggestion.", "STALE_SUGGESTION", 409);
    const record = await tx.reconciliationRecord.create({ data: { orgId: input.orgId, receiptId: receipt.id, bankTransactionId: transaction.id, matchType: input.manual ? "MANUAL_OVERRIDE" : "FUZZY_CONFIRMED", reconciledByUserId: input.userId, confidenceScore: suggestion?.confidenceScore ?? 0, notes: input.notes?.slice(0, 2000) } });
    await tx.receipt.update({ where: { id: receipt.id }, data: { status: "MATCHED", notes: null } });
    await tx.bankTransaction.update({ where: { id: transaction.id }, data: { isReconciled: true, notes: null } });
    return record.id;
  }, { timeout: 30000 });
}
