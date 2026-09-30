"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileCheck2, FileText, LayoutDashboard, ListChecks, Settings2 } from "lucide-react";
import { NavigationFeedback } from "@/components/navigation-feedback";

const links = [
  ["Overview", "", LayoutDashboard],
  ["Reconcile", "/reconcile", ListChecks],
  ["Receipts", "/receipts", FileText],
  ["Transactions", "/transactions", FileCheck2],
  ["Settings", "/settings", Settings2],
] as const;

export function WorkspaceNavigation({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  return <nav aria-label="Workspace" className="workspace-nav">
    {links.map(([label, suffix, Icon]) => {
      const href = `/dashboard/${orgSlug}${suffix}`;
      const active = pathname === href || (suffix !== "" && pathname.startsWith(`${href}/`));
      return <Link key={label} className="workspace-nav-link" href={href} aria-current={active ? "page" : undefined}>
        <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
        <span>{label}</span><NavigationFeedback />
      </Link>;
    })}
  </nav>;
}

