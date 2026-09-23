jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findUnique: jest.fn() }, ingestionJob: { findUniqueOrThrow: jest.fn() }, $transaction: jest.fn() } }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/jobs/dispatch", () => ({ dispatchJob: jest.fn() }));
import { storeReceipt } from "@/lib/receipts/service";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchJob } from "@/lib/jobs/dispatch";

const storage = { upload: jest.fn(), remove: jest.fn() };
const input = { buffer: Buffer.from("%PDF-1.4 test"), mimeType: "application/pdf", orgId: "test-org", source: "WEB_UPLOAD" as const, ingestionKey: "upload:test" };
beforeEach(() => {
  jest.resetAllMocks();
  (createAdminClient as jest.Mock).mockReturnValue({ storage: { from: () => storage } });
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  (prisma.receipt.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.ingestionJob.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: "job" });
});
test("queue outage preserves the committed receipt's original file", async () => {
  (prisma.$transaction as jest.Mock).mockResolvedValue({ id: "receipt" });
  (dispatchJob as jest.Mock).mockRejectedValue(new Error("Queue unavailable"));
  await expect(storeReceipt(input)).rejects.toThrow("Queue unavailable");
  expect(storage.remove).not.toHaveBeenCalled();
});
test("database failure removes only the uncommitted uploaded file", async () => {
  (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("Database unavailable"));
  await expect(storeReceipt(input)).rejects.toThrow("Database unavailable");
  expect(storage.remove).toHaveBeenCalledWith([expect.stringMatching(/^test-org\/.*\.pdf$/)]);
  expect(dispatchJob).not.toHaveBeenCalled();
});
