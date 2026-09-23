jest.mock("@/lib/prisma", () => ({ prisma: { organization: { findMany: jest.fn() } } }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/receipts/service", () => ({ BUCKET: "receipts-vault" }));
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupStagingUploads } from "@/lib/receipts/cleanup";
const list = jest.fn(), remove = jest.fn();
const user = "11111111-1111-4111-8111-111111111111";
const oldFile = { id: "object", name: `${user}.pdf`, created_at: "2026-09-20T00:00:00Z" };
beforeEach(() => {
  jest.resetAllMocks();
  (prisma.organization.findMany as jest.Mock).mockResolvedValue([{ id: "org" }]);
  (createAdminClient as jest.Mock).mockReturnValue({ storage: { from: () => ({ list, remove }) } });
  remove.mockResolvedValue({ error: null });
});
test("only old recognised staging objects are removed", async () => {
  list.mockResolvedValueOnce({ data: [{ name: user, id: null }, { name: "unexpected", id: null }] })
    .mockResolvedValueOnce({ data: [oldFile,
      { ...oldFile, name: `${user}.png`, updated_at: "2026-09-23T11:00:00Z" },
      { ...oldFile, name: "../original.pdf" }, { ...oldFile, created_at: "invalid" }] });
  await expect(cleanupStagingUploads(new Date("2026-09-23T12:00:00Z"))).resolves.toBe(1);
  expect(remove).toHaveBeenCalledWith([`org/staging/${user}/${user}.pdf`]);
});
test("all pages are listed before deletion so offsets do not skip files", async () => {
  list.mockResolvedValueOnce({ data: [{ name: user, id: null }] })
    .mockResolvedValueOnce({ data: Array.from({ length: 100 }, () => oldFile) })
    .mockResolvedValueOnce({ data: [oldFile] });
  await expect(cleanupStagingUploads(new Date("2026-09-23"))).resolves.toBe(101);
  expect(list.mock.calls[2][1].offset).toBe(100);
  expect(remove.mock.invocationCallOrder[0]).toBeGreaterThan(list.mock.invocationCallOrder[2]);
});
test("storage listing failures never cause deletion", async () => {
  list.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  await expect(cleanupStagingUploads()).rejects.toThrow("STAGING_LIST_FAILED");
  expect(remove).not.toHaveBeenCalled();
});
test("deletion failures are reported", async () => {
  list.mockResolvedValueOnce({ data: [{ name: user, id: null }] }).mockResolvedValueOnce({ data: [oldFile] });
  remove.mockResolvedValue({ error: { message: "unavailable" } });
  await expect(cleanupStagingUploads(new Date("2026-09-23"))).rejects.toThrow("STAGING_CLEANUP_FAILED");
});
