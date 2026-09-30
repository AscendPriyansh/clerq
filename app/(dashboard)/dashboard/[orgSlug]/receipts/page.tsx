export const metadata = { title: "Receipt vault" };

import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReceiptsVault } from "@/components/receipts-vault";
import { PageLinks } from "@/components/page-links";
import { PAGE_SIZE, pageNumber, type PageParams } from "@/lib/pagination";

export default async function Receipts({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<PageParams> }) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);
  const query = await searchParams;
  const page = pageNumber(query.page);
  const rows = await prisma.receipt.findMany({ where: { orgId: organization.id }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1, omit: { rawExtractionJson: true } });
  const receipts = rows.slice(0, PAGE_SIZE);
  const jobs = await prisma.ingestionJob.findMany({ where: { key: { in: receipts.map(row => `parse:${row.id}`) }, payload: { path: ["orgId"], equals: organization.id } }, select: { key: true, status: true, attempts: true } });
  const processingJobs = new Map(jobs.map(job => [job.key, job]));
  return <div className="workspace-page"><header className="workspace-header receipts-page-header"><div><p className="workspace-eyebrow">RECEIPTS</p><h1>Receipt vault</h1><p className="workspace-subtitle">Upload, review and keep original documents close to their matches.</p></div><span className="receipt-limit-note">10 files · 10 MB each</span></header><ReceiptsVault orgSlug={orgSlug} receipts={receipts.map(row => ({ id: row.id, source: row.source, vendorName: row.vendorName, date: row.transactionDate?.toISOString().slice(0, 10) ?? "", amount: row.totalAmount?.toString() ?? "", taxAmount: row.taxAmount?.toString() ?? "", currency: row.currency, category: row.category, status: row.status, confidenceScore: row.confidenceScore, createdAt: row.createdAt.toISOString().slice(0, 10), notes: row.notes, processingStatus: processingJobs.get(`parse:${row.id}`)?.status, processingAttempts: processingJobs.get(`parse:${row.id}`)?.attempts }))} /><PageLinks path={`/dashboard/${orgSlug}/receipts`} params={query} page={page} hasNext={rows.length > PAGE_SIZE} label="Receipts" /></div>;
}
