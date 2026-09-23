import { timingSafeEqual } from "node:crypto";
import { dispatchPendingJobs } from "@/lib/jobs/dispatch";

export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }
  return Response.json({ dispatched: await dispatchPendingJobs() });
}
