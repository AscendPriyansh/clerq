import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
try {
  // Prisma connects as the database owner. No public Data API policies are
  // granted: application access must pass the server's membership checks.
  await prisma.$transaction([
    prisma.$executeRaw`ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY`,
    prisma.$executeRaw`ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY`,
    prisma.$executeRaw`ALTER TABLE public."Membership" ENABLE ROW LEVEL SECURITY`,
    prisma.$executeRaw`ALTER TABLE public."BankTransaction" ENABLE ROW LEVEL SECURITY`,
    prisma.$executeRaw`ALTER TABLE public."Receipt" ENABLE ROW LEVEL SECURITY`,
    prisma.$executeRaw`ALTER TABLE public."ReconciliationRecord" ENABLE ROW LEVEL SECURITY`,
    prisma.$executeRaw`ALTER TABLE public."IngestionJob" ENABLE ROW LEVEL SECURITY`,
    prisma.$executeRaw`ALTER TABLE public."DismissedMatch" ENABLE ROW LEVEL SECURITY`,
  ]);
  console.log("Row-level security enabled on all application tables.");
} catch (error) {
  console.error("Database security setup failed:", error?.code ?? error?.name ?? "UnknownError");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
