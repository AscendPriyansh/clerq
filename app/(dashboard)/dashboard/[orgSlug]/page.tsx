export const metadata = { title: "Overview" };

import Link from "next/link";
import { ArrowRight, FileArchive, Forward, ReceiptText, Table2 } from "lucide-react";
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
  const stats = [
    { label: "Receipts", value: receipts, hint: "Original files in your vault", icon: ReceiptText, href: `/dashboard/${organization.slug}/receipts` },
    { label: "Transactions", value: transactions, hint: "Imported from bank CSVs", icon: Table2, href: `/dashboard/${organization.slug}/transactions` },
    { label: "Reconciled", value: reconciled, hint: "Confirmed matches", icon: FileArchive, href: `/dashboard/${organization.slug}/reconcile` },
  ];
  return <div className="workspace-page">
    <header className="workspace-header">
      <div><p className="workspace-eyebrow">{organization.name}</p><h1>Overview</h1><p className="workspace-subtitle">Your monthly records, in one place.</p></div>
      <Link href={`/dashboard/${organization.slug}/receipts`} className="workspace-primary-action">Upload receipts <ArrowRight size={15} aria-hidden="true" /></Link>
    </header>
    <section aria-label="Workspace summary" className="workspace-stat-grid">
      {stats.map(({ label, value, hint, icon: Icon, href }) => <Link key={label} href={href} className="workspace-stat-card">
        <div className="workspace-stat-icon"><Icon size={17} aria-hidden="true" /></div>
        <div><p>{label}</p><strong>{value}</strong><span>{hint}</span></div>
        <ArrowRight size={15} className="workspace-stat-arrow" aria-hidden="true" />
      </Link>)}
    </section>
    <div className="workspace-overview-grid">
      <section className="workspace-panel workspace-forwarding-panel">
        <div className="workspace-panel-heading"><div><p className="workspace-eyebrow">RECEIPT FORWARDING</p><h2>Send receipts by email</h2></div><span className="workspace-panel-icon"><Forward size={17} aria-hidden="true" /></span></div>
        <p className="workspace-panel-copy">Forward supported receipt attachments to your organisation address and Clerq will save them for processing.</p>
        <div className="forwarding-address">{organization.inboundEmailAlias ? <><span>{organization.inboundEmailAlias}</span><span className="workspace-status-badge workspace-status-ready">Configured</span></> : <><span className="forwarding-unconfigured">Email forwarding is not configured yet.</span><Link href={`/dashboard/${organization.slug}/settings`} className="workspace-inline-link">Set it up <ArrowRight size={13} aria-hidden="true" /></Link></>}</div>
      </section>
      <section className="workspace-panel">
        <div className="workspace-panel-heading"><div><p className="workspace-eyebrow">MONTHLY EXPORT</p><h2>Download your tax pack</h2></div><span className="workspace-panel-icon"><FileArchive size={17} aria-hidden="true" /></span></div>
        <p className="workspace-panel-copy">A ZIP with a reconciliation CSV and matched original files, selected by the month the match was recorded.</p>
        <ExportForm orgSlug={organization.slug} />
      </section>
    </div>
  </div>;
}
