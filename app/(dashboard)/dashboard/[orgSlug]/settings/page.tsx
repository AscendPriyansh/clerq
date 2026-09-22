import { requireMembership } from "@/lib/auth";
import { ForwardingSettings } from "@/components/forwarding-settings";

export default async function Settings({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { organization, membership } = await requireMembership((await params).orgSlug);
  return <><h2 className="text-2xl font-semibold">Settings</h2><dl className="space-y-3"><div><dt>Organisation</dt><dd>{organization.name}</dd></div><div><dt>Base currency</dt><dd>{organization.baseCurrency}</dd></div><div><dt>Your role</dt><dd>{membership.role}</dd></div><div><dt>Receipt email address</dt><dd className="break-all">{organization.inboundEmailAlias ?? "Email forwarding is not configured yet."}</dd></div></dl>{["OWNER", "ADMIN"].includes(membership.role) && <ForwardingSettings orgSlug={organization.slug} />}</>;
}
