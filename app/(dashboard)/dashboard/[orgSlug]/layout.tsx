import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { requireMembership } from "@/lib/auth";
import { SignOut } from "@/components/sign-out";

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);
  return <div className="workspace-shell">
    <aside className="workspace-sidebar">
      <div className="workspace-brand"><span className="brand-mark brand-mark-small" aria-hidden="true"><span /></span><span>Clerq</span></div>
      <div className="workspace-org"><p className="workspace-eyebrow">WORKSPACE</p><p>{organization.name}</p></div>
      <WorkspaceNavigation orgSlug={orgSlug} />
      <div className="workspace-sidebar-footer"><div className="workspace-secure-note"><span className="workspace-secure-dot" aria-hidden="true" />Private workspace</div><SignOut /></div>
    </aside>
    <main id="main-content" className="workspace-main space-y-5">{children}</main>
  </div>;
}
