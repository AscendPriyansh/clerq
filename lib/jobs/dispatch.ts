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
  const now = new Date();
  let cursor: string | undefined;
  let dispatched = 0;
  do {
    const jobs = await prisma.ingestionJob.findMany({
      where: {
        OR: [{ status: "PENDING", availableAt: { lte: now } }, { status: "RUNNING", lockedAt: { lt: new Date(now.getTime() - 600000) } }],
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(orgId ? { payload: { path: ["orgId"], equals: orgId } } : {}),
      }, orderBy: { id: "asc" }, take: 100, select: { id: true },
    });
    // Keyset pagination remains stable as consumers complete earlier batches.
    for (let index = 0; index < jobs.length; index += 10) {
      await Promise.all(jobs.slice(index, index + 10).map(job => dispatchJob(job.id)));
    }
    dispatched += jobs.length;
    if (jobs.length < 100) return dispatched;
    cursor = jobs[jobs.length - 1].id;
  } while (true);
}
