import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CsvUpload } from "@/components/csv-upload";
import { PageLinks } from "@/components/page-links";
import { PAGE_SIZE, pageNumber, type PageParams } from "@/lib/pagination";

export default async function Transactions({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<PageParams> }) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);
  const query = await searchParams;
  const page = pageNumber(query.page);
  const rows = await prisma.bankTransaction.findMany({ where: { orgId: organization.id }, orderBy: [{ transactionDate: "desc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1 });
  const transactions = rows.slice(0, PAGE_SIZE);
  return <><h2 className="text-2xl font-semibold">Transactions</h2><CsvUpload orgSlug={orgSlug} currency={organization.baseCurrency} /><p className="text-sm">Showing {transactions.length} transactions on this page.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Date", "Payee", "Amount", "Type", "Status"].map(title => <th className="border-b p-2" key={title}>{title}</th>)}</tr></thead><tbody>{transactions.map(row => <tr key={row.id}><td className="p-2">{row.transactionDate.toISOString().slice(0, 10)}</td><td className="p-2">{row.counterpartyName}</td><td className="p-2">{row.currency} {row.amount.toFixed(2)}</td><td className="p-2">{row.type}</td><td className="p-2">{row.isReconciled ? "RECONCILED" : row.type === "CREDIT" ? "CREDIT — NOT MATCHED" : "MISSING_RECEIPT"}</td></tr>)}</tbody></table></div><PageLinks path={`/dashboard/${orgSlug}/transactions`} params={query} page={page} hasNext={rows.length > PAGE_SIZE} /></>;
}
