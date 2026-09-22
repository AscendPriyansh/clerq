"use server";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function activateForwarding(orgSlug: string) {
  try {
    const { organization, membership } = await requireMembership(orgSlug);
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") return { error: "Only owners and admins can activate email forwarding." };
    const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase();
    if (!domain || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain) || !process.env.RESEND_API_KEY || !process.env.RESEND_WEBHOOK_SECRET) return { error: "Configure the Resend API key, webhook secret and receiving domain first." };
    await prisma.organization.update({ where: { id: organization.id }, data: { inboundEmailAlias: `${organization.slug}@${domain}` } });
    revalidatePath(`/dashboard/${orgSlug}`, "layout");
    return { success: true };
  } catch { return { error: "Unable to activate email forwarding." }; }
}
