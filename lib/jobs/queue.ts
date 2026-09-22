import "server-only";
import { Prisma, type JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function enqueue(type: JobType, key: string, payload: Prisma.InputJsonValue) {
  try {
    return await prisma.ingestionJob.upsert({ where: { key }, update: {}, create: { type, key, payload } });
  } catch (error) {
    // Two deliveries can both observe a missing row before Prisma inserts it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.ingestionJob.findUniqueOrThrow({ where: { key } });
    }
    throw error;
  }
}
