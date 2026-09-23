jest.mock("@/lib/auth", () => ({ requireMembership: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/receipts/service", () => ({ BUCKET: "receipts-vault", downloadReceipt: jest.fn(), storeReceipt: jest.fn() }));
import { POST as prepare } from "@/app/api/receipts/upload/route";
import { POST as complete } from "@/app/api/receipts/upload/complete/route";
import { requireMembership } from "@/lib/auth";
import { AppError } from "@/lib/errors";
beforeEach(() => jest.resetAllMocks());
test.each([prepare, complete])("invalid JSON and missing fields return 400, not a server error", async handler => {
  for (const body of ["{", "{}", "null"]) {
    const response = await handler(new Request("http://localhost/test", { method: "POST", body }));
    expect(response.status).toBe(400);
  }
  expect(requireMembership).not.toHaveBeenCalled();
});
test.each([
  [prepare, { orgSlug: "test", mimeType: "image/png", size: 100 }],
  [complete, { orgSlug: "test", mimeType: "image/png", path: "anything" }],
] as const)("valid upload payloads still require authentication", async (handler, input) => {
  (requireMembership as jest.Mock).mockRejectedValue(new AppError("Authentication required", "UNAUTHENTICATED", 401));
  const response = await handler(new Request("http://localhost/test", { method: "POST", body: JSON.stringify(input) }));
  expect(response.status).toBe(401);
});
test("oversized request bodies are rejected", async () => {
  const response = await prepare(new Request("http://localhost/test", { method: "POST", body: "x".repeat(4097) }));
  expect(response.status).toBe(413);
});
