import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSuggestions } from "@/lib/reconciliation/matcher";
import { ReconciliationCockpit } from "@/components/reconciliation-cockpit";
import { PageLinks } from "@/components/page-links";
import { PAGE_SIZE, pageNumber, type PageParams } from "@/lib/pagination";
import type { Prisma, ReceiptStatus } from "@prisma/client";

export default async function Reconcile({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<PageParams> }) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);
  const query = await searchParams;
  const suggestions = await getSuggestions(organization.id);
  const suggestedIds = [...new Set(suggestions.map(pair => pair.bankTransactionId))];
  const bankPage = pageNumber(query.bankPage), receiptPage = pageNumber(query.receiptPage), suggestionPage = pageNumber(query.suggestionPage);
  const bankWhere: Prisma.BankTransactionWhereInput = { orgId: organization.id, type: "DEBIT" };
  if (query.bankStatus === "RECONCILED") bankWhere.isReconciled = true;
  if (query.bankStatus === "SUGGESTED") { bankWhere.isReconciled = false; bankWhere.id = { in: suggestedIds }; }
  if (query.bankStatus === "MISSING_RECEIPT") { bankWhere.isReconciled = false; bankWhere.id = { notIn: suggestedIds }; }
  const receiptStatus = typeof query.receiptStatus === "string" && ["MATCHED", "UNMATCHED", "FLAGGED", "PROCESSING"].includes(query.receiptStatus) ? query.receiptStatus as ReceiptStatus : undefined;
  const [transactions, receipts] = await Promise.all([
    prisma.bankTransaction.findMany({ where: bankWhere, orderBy: [{ transactionDate: "desc" }, { id: "asc" }], skip: (bankPage - 1) * PAGE_SIZE, take: PAGE_SIZE + 1, select: { id: true, transactionDate: true, counterpartyName: true, amount: true, currency: true, isReconciled: true } }),
    prisma.receipt.findMany({ where: { orgId: organization.id, ...(receiptStatus ? { status: receiptStatus } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (receiptPage - 1) * PAGE_SIZE, take: PAGE_SIZE + 1, select: { id: true, transactionDate: true, vendorName: true, totalAmount: true, currency: true, status: true, category: true } }),
  ]);
  const suggestedTransactions = new Set(suggestions.map(pair => pair.bankTransactionId));
  const path = `/dashboard/${orgSlug}/reconcile`;
  return <><h2 className="text-2xl font-semibold">Reconcile</h2><ReconciliationCockpit orgSlug={orgSlug}
    transactions={transactions.slice(0, PAGE_SIZE).map(row => ({ id: row.id, date: row.transactionDate.toISOString().slice(0, 10), name: row.counterpartyName, amount: row.amount.toString(), currency: row.currency, status: row.isReconciled ? "RECONCILED" : suggestedTransactions.has(row.id) ? "SUGGESTED" : "MISSING_RECEIPT" }))}
    receipts={receipts.slice(0, PAGE_SIZE).map(row => ({ id: row.id, date: row.transactionDate?.toISOString().slice(0, 10) ?? "", name: row.vendorName ?? "Awaiting extraction", amount: row.totalAmount?.toString() ?? "—", currency: row.currency, status: row.status, category: row.category }))}
    suggestions={suggestions.slice((suggestionPage - 1) * PAGE_SIZE, suggestionPage * PAGE_SIZE)} suggestionCount={suggestions.length}
    bankPagination={<PageLinks path={path} params={query} pageKey="bankPage" page={bankPage} hasNext={transactions.length > PAGE_SIZE} label="Bank transactions" />}
    receiptPagination={<PageLinks path={path} params={query} pageKey="receiptPage" page={receiptPage} hasNext={receipts.length > PAGE_SIZE} label="Receipts" />}
    suggestionPagination={<PageLinks path={path} params={query} pageKey="suggestionPage" page={suggestionPage} hasNext={suggestions.length > suggestionPage * PAGE_SIZE} label="Suggestions" />}
  /></>;
}
