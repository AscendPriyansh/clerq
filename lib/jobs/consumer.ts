import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { processNextJob } from "./processor";

export async function consumeJob(message: unknown) {
  const { jobId } = z.object({ jobId: z.string().uuid() }).parse(message);
  await processNextJob(jobId);
  const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
  // Do not acknowledge an unclaimed, delayed or interrupted database job.
  if (job && (job.status === "PENDING" || job.status === "RUNNING")) {
    throw new Error("JOB_RETRY_REQUIRED");
  }
}
