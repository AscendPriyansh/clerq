import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CsvUpload } from "@/components/csv-upload";

export default async function Transactions({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);
  const transactions = await prisma.bankTransaction.findMany({ where: { orgId: organization.id }, orderBy: [{ transactionDate: "desc" }, { id: "asc" }], take: 500 });
  return <><h2 className="text-2xl font-semibold">Transactions</h2><CsvUpload orgSlug={orgSlug} currency={organization.baseCurrency} /><p className="text-sm">Showing the latest {transactions.length} transactions (up to 500).</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Date", "Payee", "Amount", "Type", "Status"].map(title => <th className="border-b p-2" key={title}>{title}</th>)}</tr></thead><tbody>{transactions.map(row => <tr key={row.id}><td className="p-2">{row.transactionDate.toISOString().slice(0, 10)}</td><td className="p-2">{row.counterpartyName}</td><td className="p-2">{row.currency} {row.amount.toFixed(2)}</td><td className="p-2">{row.type}</td><td className="p-2">{row.isReconciled ? "RECONCILED" : row.type === "CREDIT" ? "CREDIT — NOT MATCHED" : "MISSING_RECEIPT"}</td></tr>)}</tbody></table></div></>;
}
