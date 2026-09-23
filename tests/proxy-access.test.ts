jest.mock("@/lib/prisma", () => ({ prisma: { membership: { findFirst: jest.fn() } } }));
jest.mock("@/lib/supabase/middleware", () => ({ refreshSession: jest.fn() }));
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";
import { prisma } from "@/lib/prisma";
import { refreshSession } from "@/lib/supabase/middleware";
beforeEach(() => {
  jest.resetAllMocks();
  (refreshSession as jest.Mock).mockResolvedValue({ response: NextResponse.next(), user: { id: "user" } });
});
test("allowed workspace access needs one scoped membership query", async () => {
  (prisma.membership.findFirst as jest.Mock).mockResolvedValue({ id: "membership" });
  const response = await proxy(new NextRequest("http://localhost/dashboard/ours/receipts"));
  expect(response.status).toBe(200);
  expect(prisma.membership.findFirst).toHaveBeenCalledTimes(1);
  expect(prisma.membership.findFirst).toHaveBeenCalledWith({ where: { userId: "user", organization: { slug: "ours" } }, select: { id: true } });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
test("foreign workspace redirects only to a permitted organisation", async () => {
  (prisma.membership.findFirst as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ organization: { slug: "ours" } });
  const response = await proxy(new NextRequest("http://localhost/dashboard/foreign"));
  expect(response.headers.get("location")).toBe("http://localhost/dashboard/ours");
});
test("unauthenticated access never queries tenant data", async () => {
  (refreshSession as jest.Mock).mockResolvedValue({ response: NextResponse.next(), user: null });
  const response = await proxy(new NextRequest("http://localhost/dashboard/ours"));
  expect(response.status).toBe(307);
  expect(prisma.membership.findFirst).not.toHaveBeenCalled();
});
