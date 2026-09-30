export const metadata = { title: "Settings" };

import { Check, Info, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { requireMembership } from "@/lib/auth";
import { ForwardingSettings } from "@/components/forwarding-settings";

export default async function Settings({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { organization, membership } = await requireMembership((await params).orgSlug);
  const isAdmin = ["OWNER", "ADMIN"].includes(membership.role);
  const isConfigured = Boolean(organization.inboundEmailAlias);
  return <div className="workspace-page settings-page"><header className="workspace-header settings-page-header"><div><p className="workspace-eyebrow">WORKSPACE SETTINGS</p><h1>Settings</h1><p className="workspace-subtitle">Review how your organisation receives and stores records.</p></div><span className="settings-readonly-badge"><LockKeyhole size={12} /> Read-only details</span></header>
    <div className="settings-grid">
      <section className="settings-panel"><div className="settings-panel-heading"><div><p className="workspace-eyebrow">ORGANISATION</p><h2>Workspace details</h2></div><span className="workspace-panel-icon"><ShieldCheck size={17} /></span></div><dl className="settings-details"><div><dt>Organisation</dt><dd>{organization.name}</dd></div><div><dt>Base currency</dt><dd>{organization.baseCurrency}</dd></div><div><dt>Your role</dt><dd><span className="settings-role-badge">{membership.role}</span></dd></div></dl><p className="settings-helper"><Info size={14} /> Organisation details are shown here for reference.</p></section>
      <section className="settings-panel settings-forwarding-panel"><div className="settings-panel-heading"><div><p className="workspace-eyebrow">RECEIPT EMAIL</p><h2>Forward receipts to Clerq</h2></div><span className={`settings-mail-icon ${isConfigured ? "settings-mail-active" : ""}`}><Mail size={17} /></span></div><p className="settings-copy">Forward receipt attachments to the address below. Clerq saves the original file and queues it for extraction.</p><div className={`settings-address ${isConfigured ? "settings-address-configured" : ""}`}>{isConfigured ? <><div><span className="settings-address-label">YOUR RECEIPT ADDRESS</span><strong>{organization.inboundEmailAlias}</strong></div><span className="settings-active-badge"><Check size={12} /> Active</span></> : <><div><span className="settings-address-label">STATUS</span><strong className="settings-unconfigured">Email forwarding is not configured yet.</strong></div><span className="settings-pending-badge">Not active</span></>}</div>{isAdmin ? <ForwardingSettings orgSlug={organization.slug} configured={isConfigured} /> : <p className="settings-helper"><Info size={14} /> Owners and admins can activate email forwarding for this workspace.</p>}</section>
    </div>
  </div>;
}
