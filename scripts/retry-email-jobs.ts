import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { prisma } = await import("../lib/prisma");
  try {
    const result = await prisma.ingestionJob.updateMany({ where: { type: "EMAIL_INGEST", status: "FAILED" }, data: { status: "PENDING", attempts: 0, availableAt: new Date(), lockedAt: null, lastError: null } });
    console.log(`Requeued ${result.count} failed email jobs.`);
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("Unable to retry email jobs."); process.exitCode = 1; });
