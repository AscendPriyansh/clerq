import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Dashboard() {
  const user = await requireUser();
  const membership = await prisma.membership.findFirst({ where: { userId: user.id }, include: { organization: true }, orderBy: { id: "asc" } });
  redirect(membership ? `/dashboard/${membership.organization.slug}` : "/onboarding");
}
