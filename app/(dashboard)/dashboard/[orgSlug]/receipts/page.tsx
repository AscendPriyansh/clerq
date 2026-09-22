import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReceiptsVault } from "@/components/receipts-vault";

export default async function Receipts({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);
  const receipts = await prisma.receipt.findMany({ where: { orgId: organization.id }, orderBy: { createdAt: "desc" }, take: 500 });
  return <><h2 className="text-2xl font-semibold">Receipts vault</h2><p className="text-sm">Latest {receipts.length} receipts (up to 500).</p><ReceiptsVault orgSlug={orgSlug} receipts={receipts.map(row => ({ id: row.id, source: row.source, vendorName: row.vendorName, date: row.transactionDate?.toISOString().slice(0, 10) ?? "", amount: row.totalAmount?.toString() ?? "", taxAmount: row.taxAmount?.toString() ?? "", currency: row.currency, category: row.category, status: row.status, confidenceScore: row.confidenceScore, createdAt: row.createdAt.toISOString().slice(0, 10), notes: row.notes }))} /></>;
}
