import "server-only";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { cache } from "react";

export class AccessError extends AppError {}

// Every action/route must check its own tenant scope, even after middleware runs.
export const requireUser = cache(async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AccessError("Authentication required", "UNAUTHENTICATED", 401);
  return user;
});

export const requireMembership = cache(async function requireMembership(orgSlug: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organization: { slug: orgSlug } },
    include: { organization: true },
  });
  if (!membership) throw new AccessError("Organisation access denied", "FORBIDDEN", 403);
  return { user, membership, organization: membership.organization };
});
