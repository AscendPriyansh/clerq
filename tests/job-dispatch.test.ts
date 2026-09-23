jest.mock("@vercel/queue", () => ({ send: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { ingestionJob: { findMany: jest.fn() } } }));
import { send } from "@vercel/queue";
import { prisma } from "@/lib/prisma";
import { dispatchPendingJobs } from "@/lib/jobs/dispatch";
const find = prisma.ingestionJob.findMany as jest.Mock;
const original = process.env.VERCEL;
beforeEach(() => { jest.resetAllMocks(); process.env.VERCEL = "1"; });
afterAll(() => { if (original === undefined) delete process.env.VERCEL; else process.env.VERCEL = original; });
test("recovery dispatches beyond the first 100 jobs with a stable cursor", async () => {
  find.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: String(i).padStart(3, "0") })))
    .mockResolvedValueOnce([{ id: "100" }]);
  await expect(dispatchPendingJobs("org")).resolves.toBe(101);
  expect(send).toHaveBeenCalledTimes(101);
  expect(find.mock.calls[1][0].where).toMatchObject({ id: { gt: "099" }, payload: { path: ["orgId"], equals: "org" } });
  expect(find.mock.calls[0][0].where.OR).toEqual(find.mock.calls[1][0].where.OR);
});
test("queue outages are surfaced for recovery", async () => {
  find.mockResolvedValue([{ id: "one" }]);
  (send as jest.Mock).mockRejectedValue(new Error("Unavailable"));
  await expect(dispatchPendingJobs()).rejects.toThrow("Unavailable");
});
test("local development leaves dispatch to the local worker", async () => {
  delete process.env.VERCEL;
  await expect(dispatchPendingJobs()).resolves.toBe(0);
  expect(find).not.toHaveBeenCalled();
});
