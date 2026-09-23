import Link from "next/link";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { requireMembership } from "@/lib/auth";
import { SignOut } from "@/components/sign-out";

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);
  const links = [["Overview", ""], ["Reconcile", "/reconcile"], ["Receipts", "/receipts"], ["Transactions", "/transactions"], ["Settings", "/settings"]];
  return <div className="min-h-screen md:flex">
    <aside className="space-y-5 border-r p-6 md:w-60"><h1 className="text-xl font-semibold">Clerq</h1><p className="break-words">{organization.name}</p><nav aria-label="Workspace" className="flex flex-wrap gap-3 md:flex-col">{links.map(([label, suffix]) => <Link key={label} className="underline" href={`/dashboard/${orgSlug}${suffix}`}>{label}<NavigationFeedback /></Link>)}</nav><SignOut /></aside>
    <main className="min-w-0 flex-1 space-y-5 p-6">{children}</main>
  </div>;
}
