import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSuggestions } from "@/lib/reconciliation/matcher";
import { ReconciliationCockpit } from "@/components/reconciliation-cockpit";

export default async function Reconcile({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);
  const [transactions, receipts, suggestions] = await Promise.all([
    prisma.bankTransaction.findMany({ where: { orgId: organization.id, type: "DEBIT" }, orderBy: { transactionDate: "desc" } }),
    prisma.receipt.findMany({ where: { orgId: organization.id }, orderBy: { createdAt: "desc" } }), getSuggestions(organization.id),
  ]);
  const suggestedTransactions = new Set(suggestions.map(pair => pair.bankTransactionId));
  return <><h2 className="text-2xl font-semibold">Reconcile</h2><ReconciliationCockpit orgSlug={orgSlug} transactions={transactions.map(row => ({ id: row.id, date: row.transactionDate.toISOString().slice(0, 10), name: row.counterpartyName, amount: row.amount.toString(), currency: row.currency, status: row.isReconciled ? "RECONCILED" : suggestedTransactions.has(row.id) ? "SUGGESTED" : "MISSING_RECEIPT" }))} receipts={receipts.map(row => ({ id: row.id, date: row.transactionDate?.toISOString().slice(0, 10) ?? "", name: row.vendorName ?? "Awaiting extraction", amount: row.totalAmount?.toString() ?? "—", currency: row.currency, status: row.status, category: row.category }))} suggestions={suggestions} /></>;
}
