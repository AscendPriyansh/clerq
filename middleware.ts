import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  let refreshed: NextResponse | undefined;
  function finish(response: NextResponse) {
    refreshed?.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  }
  function deny(message: string, code: string, status: number, destination: string) {
    if (isApi) return finish(NextResponse.json({ error: message, code }, { status }));
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    if (status === 401) url.searchParams.set("next", pathname);
    return finish(NextResponse.redirect(url));
  }
  try {
    const { response, user } = await refreshSession(request);
    refreshed = response;
    if (!user) return deny("Authentication required", "UNAUTHENTICATED", 401, "/login");
    if (pathname === "/onboarding") return finish(response);
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      select: { organization: { select: { slug: true } } },
      orderBy: { id: "asc" },
    });
    if (!membership) return deny("Create an organisation first", "ORGANIZATION_REQUIRED", 403, "/onboarding");
    const slug = pathname.match(/^\/dashboard\/([^/]+)/)?.[1];
    if (slug) {
      const allowed = await prisma.membership.findFirst({
        where: { userId: user.id, organization: { slug } },
        select: { id: true },
      });
      if (!allowed) return deny("Organisation access denied", "FORBIDDEN", 403, `/dashboard/${membership.organization.slug}`);
    }
    return finish(response);
  } catch (error) {
    console.error("Access verification failed", error instanceof Error ? error.name : "UnknownError");
    return finish(NextResponse.json({ error: "Unable to verify access. Check service configuration.", code: "SERVICE_UNAVAILABLE" }, { status: 503 }));
  }
}

export const config = {
  runtime: "nodejs",
  matcher: ["/dashboard/:path*", "/api/export/:path*", "/api/ai/:path*", "/onboarding"],
};
