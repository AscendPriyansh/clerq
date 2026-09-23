import "server-only";
import { send } from "@vercel/queue";
import { prisma } from "@/lib/prisma";

// PostgreSQL remains the durable source of truth. Local development uses worker.ts.
export async function dispatchJob(jobId: string) {
  if (process.env.VERCEL !== "1") return;
  await send("clerq-jobs", { jobId }, { retentionSeconds: 604800 });
}

export async function dispatchPendingJobs(orgId?: string) {
  if (process.env.VERCEL !== "1") return 0;
  const jobs = await prisma.ingestionJob.findMany({
    where: {
      OR: [{ status: "PENDING", availableAt: { lte: new Date() } }, { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - 600000) } }],
      ...(orgId ? { payload: { path: ["orgId"], equals: orgId } } : {}),
    }, orderBy: { availableAt: "asc" }, take: 100, select: { id: true },
  });
  for (const job of jobs) await dispatchJob(job.id);
  return jobs.length;
}
