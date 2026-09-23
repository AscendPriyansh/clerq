import { timingSafeEqual } from "node:crypto";
import { dispatchPendingJobs } from "@/lib/jobs/dispatch";
import { cleanupStagingUploads } from "@/lib/receipts/cleanup";

export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }
  const results = await Promise.allSettled([dispatchPendingJobs(), cleanupStagingUploads()]);
  const failed = results.some(result => result.status === "rejected");
  if (failed) console.error("Scheduled maintenance failed", results.map(result => result.status));
  return Response.json({
    dispatched: results[0].status === "fulfilled" ? results[0].value : null,
    stagingRemoved: results[1].status === "fulfilled" ? results[1].value : null,
    ...(failed ? { error: "Maintenance incomplete; check job recovery and storage." } : {}),
  }, { status: failed ? 503 : 200 });
}
