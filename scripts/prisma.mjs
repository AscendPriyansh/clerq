import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";

// Prisma 6 does not read Next.js .env.local automatically.
nextEnv.loadEnvConfig(process.cwd());
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
if (result.status === 0 && process.argv[2] === "db" && process.argv[3] === "push") {
  const security = spawnSync(process.execPath, ["scripts/secure-db.mjs"], { stdio: "inherit", env: process.env });
  process.exit(security.status ?? 1);
}
process.exit(result.status ?? 1);
