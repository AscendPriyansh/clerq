import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExportForm } from "@/components/export-form";

export default async function Overview({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { organization } = await requireMembership((await params).orgSlug);
  const [receipts, transactions, reconciled] = await Promise.all([
    prisma.receipt.count({ where: { orgId: organization.id } }),
    prisma.bankTransaction.count({ where: { orgId: organization.id } }),
    prisma.reconciliationRecord.count({ where: { orgId: organization.id } }),
  ]);
  return <><h2 className="text-2xl font-semibold">Overview</h2><dl className="grid gap-4 sm:grid-cols-3">{[["Receipts", receipts], ["Transactions", transactions], ["Reconciled", reconciled]].map(([label, value]) => <div key={label} className="rounded border p-4"><dt>{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}</dl><p>Receipt forwarding address: <strong className="break-all">{organization.inboundEmailAlias ?? "Email forwarding is not configured yet."}</strong></p><ExportForm orgSlug={organization.slug} /></>;
}
