import "server-only";
import { Prisma, type JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dispatchJob } from "./dispatch";

export async function enqueue(type: JobType, key: string, payload: Prisma.InputJsonValue) {
  let job;
  try {
    job = await prisma.ingestionJob.upsert({ where: { key }, update: {}, create: { type, key, payload } });
  } catch (error) {
    // Two deliveries can both observe a missing row before Prisma inserts it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      job = await prisma.ingestionJob.findUniqueOrThrow({ where: { key } });
    } else throw error;
  }
  if (job.status === "PENDING") await dispatchJob(job.id);
  return job;
}
