import { handleCallback } from "@vercel/queue";
import { consumeJob } from "@/lib/jobs/consumer";

export const runtime = "nodejs";
export const maxDuration = 300;

// vercel.json makes this a private queue consumer, not a public HTTP endpoint.
export const POST = handleCallback(consumeJob, { visibilityTimeoutSeconds: 600, retry: () => ({ afterSeconds: 60 }) });
