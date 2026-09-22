"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createOrganization(_previous: { error: string }, formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) return { error: "Enter an organisation name between 2 and 100 characters." };
  if (!user.email) return { error: "Your account needs a verified email address." };
  const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase();
  if (domain && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain)) {
    return { error: "The configured receiving domain is invalid. Contact your administrator." };
  }
  const baseSlug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45).replace(/-$/, "") || "organisation";
  let slug = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${randomUUID().slice(0, 8)}`;
    try {
      await prisma.$transaction(async tx => {
        await tx.user.upsert({
          where: { id: user.id },
          create: { id: user.id, email: user.email!, name: typeof user.user_metadata.name === "string" ? user.user_metadata.name.slice(0, 120) : null },
          update: { email: user.email! },
        });
        await tx.organization.create({ data: { name, slug: candidate, inboundEmailAlias: domain ? `${candidate}@${domain}` : null, memberships: { create: { userId: user.id, role: "OWNER" } } } });
      });
      slug = candidate;
      break;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      console.error("Organisation creation failed", error instanceof Error ? error.name : "UnknownError");
      return { error: "Unable to create your organisation. Please try again." };
    }
  }
  if (!slug) return { error: "Unable to reserve an organisation address. Please try another name." };
  redirect(`/dashboard/${slug}`);
}
