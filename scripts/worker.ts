import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { processNextJob } = await import("../lib/jobs/processor");
  const { prisma } = await import("../lib/prisma");
  let stop = false;
  process.on("SIGINT", () => { stop = true; });
  process.on("SIGTERM", () => { stop = true; });
  const once = process.argv.includes("--once");
  try {
    do {
      const processed = await processNextJob();
      if (!processed && !once) await new Promise(resolve => setTimeout(resolve, 3000));
    } while (!stop && !once);
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error("Worker stopped", error instanceof Error ? error.name : "UnknownError"); process.exitCode = 1; });
