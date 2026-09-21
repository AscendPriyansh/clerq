import "server-only";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export class AccessError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
  }
}

// Every action/route must check its own tenant scope, even after middleware runs.
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AccessError("Authentication required", "UNAUTHENTICATED", 401);
  return user;
}

export async function requireMembership(orgSlug: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organization: { slug: orgSlug } },
    include: { organization: true },
  });
  if (!membership) throw new AccessError("Organisation access denied", "FORBIDDEN", 403);
  return { user, membership, organization: membership.organization };
}
