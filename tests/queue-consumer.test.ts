jest.mock("@/lib/prisma", () => ({ prisma: { ingestionJob: { findUnique: jest.fn() } } }));
jest.mock("@/lib/jobs/processor", () => ({ processNextJob: jest.fn() }));
import { consumeJob } from "@/lib/jobs/consumer";
import { prisma } from "@/lib/prisma";
import { processNextJob } from "@/lib/jobs/processor";

const jobId = "3f4d835d-0c24-4ca8-92f4-444de54dc03b";
const find = prisma.ingestionJob.findUnique as jest.Mock;
beforeEach(() => jest.resetAllMocks());
test.each(["PENDING", "RUNNING"])("%s jobs remain eligible for queue redelivery", async status => {
  find.mockResolvedValue({ status });
  await expect(consumeJob({ jobId })).rejects.toThrow("JOB_RETRY_REQUIRED");
  expect(processNextJob).toHaveBeenCalledWith(jobId);
});
test.each(["COMPLETED", "FAILED"])("%s jobs acknowledge the delivery", async status => {
  find.mockResolvedValue({ status });
  await expect(consumeJob({ jobId })).resolves.toBeUndefined();
});
test("deleted jobs acknowledge stale deliveries", async () => {
  find.mockResolvedValue(null);
  await expect(consumeJob({ jobId })).resolves.toBeUndefined();
});
test("invalid payloads never reach the processor", async () => {
  await expect(consumeJob({ jobId: "invalid" })).rejects.toThrow();
  expect(processNextJob).not.toHaveBeenCalled();
});
test("processor connection failures propagate for redelivery", async () => {
  (processNextJob as jest.Mock).mockRejectedValue(new Error("Database unavailable"));
  await expect(consumeJob({ jobId })).rejects.toThrow("Database unavailable");
});
