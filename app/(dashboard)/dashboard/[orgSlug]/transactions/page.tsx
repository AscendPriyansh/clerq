export const metadata = { title: "Transactions" };

import { ArrowDownLeft, ArrowUpRight, Check, CircleAlert, FileSpreadsheet } from "lucide-react";
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
  return <div className="workspace-page"><header className="workspace-header transactions-page-header"><div><p className="workspace-eyebrow">BANK TRANSACTIONS</p><h1>Transactions</h1><p className="workspace-subtitle">Import a statement and see which payments have a receipt.</p></div><span className="receipt-limit-note">CSV · 4 MB · 10,000 rows</span></header><CsvUpload orgSlug={orgSlug} currency={organization.baseCurrency} /><section className="transactions-list-section"><div className="transactions-list-heading"><div><p className="workspace-eyebrow">TRANSACTION LEDGER</p><h2>Imported transactions</h2></div><span className="receipt-count">{transactions.length} on this page</span></div>{transactions.length ? <div className="transactions-table-wrap"><table className="transactions-table"><thead><tr>{["Date", "Payee", "Amount / currency", "Type", "Status"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{transactions.map(row => <tr key={row.id}><td className="transaction-date">{row.transactionDate.toISOString().slice(0, 10)}</td><td><strong className="transaction-payee">{row.counterpartyName}</strong><span className="receipt-note">Imported bank record</span></td><td><strong>{row.currency} {row.amount.toFixed(2)}</strong></td><td><span className={`transaction-type ${row.type === "CREDIT" ? "transaction-type-credit" : ""}`}>{row.type === "CREDIT" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}{row.type}</span></td><td>{row.isReconciled ? <span className="transaction-status transaction-status-reconciled"><Check size={12} />Reconciled</span> : row.type === "CREDIT" ? <span className="transaction-status transaction-status-credit"><FileSpreadsheet size={12} />Credit — not matched</span> : <span className="transaction-status transaction-status-missing"><CircleAlert size={12} />Missing receipt</span>}</td></tr>)}</tbody></table></div> : <div className="transaction-empty-state"><span className="receipt-upload-icon"><FileSpreadsheet size={19} /></span><h3>No transactions imported yet</h3><p>Upload a bank CSV above to begin matching payments to receipts.</p></div>}</section><PageLinks path={`/dashboard/${orgSlug}/transactions`} params={query} page={page} hasNext={rows.length > PAGE_SIZE} label="Transactions" /></div>;
}
