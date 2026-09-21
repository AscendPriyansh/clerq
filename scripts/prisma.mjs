import { loadEnvConfig } from "@next/env";
import { spawnSync } from "node:child_process";

// Prisma 6 does not read Next.js .env.local automatically.
loadEnvConfig(process.cwd());
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
